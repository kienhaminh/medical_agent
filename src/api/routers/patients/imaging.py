"""Patient imaging operations."""
import asyncio
import io
import logging
import shutil
import time
import uuid
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, Imaging, ImageGroup
from src.tools.medical_img_segmentation_tool import (
    _call_segmentation_mcp,
    _rewrite_for_mcp,
    _MODALITY_PARAM,
)
from src.utils.upload_storage import (
    local_path_from_public_url,
    normalize_docker_urls,
    patient_imaging_dir,
    public_url_for_rel,
)
from pydantic import BaseModel, model_validator

from ...models import ImagingResponse, ImageGroupResponse, ImageGroupCreate, ImagingCreate
from src.api.routers.patients.segmentation_worker import _run_segmentation_background

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])

# Strong reference set to prevent asyncio background tasks from being garbage-collected
# before they complete. Tasks are discarded automatically via add_done_callback.
_background_tasks: set[asyncio.Task] = set()


class SegmentAsyncRequest(BaseModel):
    """Body for the non-blocking segment-async endpoint."""
    user_id: str | None = None    # used for WS notification (manual path)
    session_id: int | None = None  # used for agent report (agent path)

    @model_validator(mode="after")
    def require_at_least_one(self) -> "SegmentAsyncRequest":
        if self.user_id is None and self.session_id is None:
            raise ValueError("At least one of user_id or session_id must be provided")
        return self


def _extract_aligned_preview(nii_path: Path, slice_idx: int, out_path: Path) -> bool:
    """Extract an axial slice from a NIfTI volume and save it as a new JPEG.

    Saves to out_path — never overwrites the original upload preview.
    Orientation and normalization are identical to the segmentation MCP server
    so the aligned preview and the segmentation overlay are pixel-aligned:
      - MCP: data.transpose(2,1,0)[z,:,:] == data[:,:,z].T  → shape (y,x)
      - Normalization: non-zero pixels only, p1–p99 (matches MCP's _normalize_slice_u8)

    Returns True on success, False on any error (non-fatal).
    """
    try:
        import nibabel as nib  # optional dep — only needed at segment time

        img = nib.load(str(nii_path))
        data = np.asarray(img.dataobj)  # shape (x, y, z), lazy load
        if slice_idx < 0 or slice_idx >= data.shape[2]:
            logger.warning("slice_idx %d out of range for volume shape %s", slice_idx, data.shape)
            return False

        # Match MCP orientation: data.transpose(2,1,0)[z,:,:] == data[:,:,z].T → (y,x)
        slice_yx = data[:, :, slice_idx].T.astype(np.float32)

        # Match MCP normalization: non-zero pixels only, p1–p99
        nz = slice_yx[slice_yx != 0]
        if nz.size == 0:
            normed = np.zeros(slice_yx.shape, dtype=np.uint8)
        else:
            lo, hi = float(np.percentile(nz, 1)), float(np.percentile(nz, 99))
            if hi - lo < 1e-8:
                lo, hi = float(nz.min()), float(nz.max())
            if hi - lo < 1e-8:
                normed = np.zeros(slice_yx.shape, dtype=np.uint8)
            else:
                normed = np.clip((slice_yx - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)

        # Upscale to a standard display size so the preview is crisp in the UI.
        # BraTS axial slices are 240×240 — too small without interpolation.
        pil_img = Image.fromarray(normed, mode="L").resize((512, 512), Image.LANCZOS)
        pil_img.convert("RGB").save(str(out_path), "JPEG", quality=90)
        return True
    except Exception:
        logger.exception("Failed to extract aligned preview at slice %d from %s", slice_idx, nii_path)
        return False


def _extract_slice_jpeg(
    nii_path: Path, slice_z: int, mask_path: Path | None, alpha: float = 0.45
) -> bytes:
    """Extract axial slice z from a NIfTI and return JPEG bytes.

    Orientation and normalization match _extract_aligned_preview exactly:
      data[:, :, z].T  →  shape (y, x)

    If mask_path is given, blends the 3-D prediction mask (ZYX order,
    saved by the MCP as full_pred) onto the grayscale slice using the
    same color scheme as the MCP overlay (red/green/blue for classes 1/2/3).
    """
    import nibabel as nib

    img = nib.load(str(nii_path))
    data = np.asarray(img.dataobj)  # (x, y, z) for raw BraTS modality NIfTIs
    if slice_z < 0 or slice_z >= data.shape[2]:
        raise ValueError(f"slice_z {slice_z} out of range for shape {data.shape}")

    slice_yx = data[:, :, slice_z].T.astype(np.float32)

    # Normalize (p1-p99 on non-zero voxels — identical to MCP)
    nz = slice_yx[slice_yx != 0]
    if nz.size == 0:
        normed = np.zeros(slice_yx.shape, dtype=np.uint8)
    else:
        lo, hi = float(np.percentile(nz, 1)), float(np.percentile(nz, 99))
        if hi - lo < 1e-8:
            lo, hi = float(nz.min()), float(nz.max())
        normed = np.clip((slice_yx - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)

    base_rgb = np.stack([normed, normed, normed], axis=-1).astype(np.float32)

    if mask_path and mask_path.is_file():
        mask_img = nib.load(str(mask_path))
        # full_pred was saved as (z, y, x) — index directly by z
        mask_data = np.asarray(mask_img.dataobj)
        label_yx = (
            mask_data[slice_z, :, :]
            if slice_z < mask_data.shape[0]
            else np.zeros(base_rgb.shape[:2], dtype=np.uint8)
        )
        color_map = {
            1: np.array([255.0, 0.0, 0.0], dtype=np.float32),
            2: np.array([0.0, 255.0, 0.0], dtype=np.float32),
            3: np.array([0.0, 0.0, 255.0], dtype=np.float32),
        }
        overlay = base_rgb.copy()
        for cls, color in color_map.items():
            m = label_yx == cls
            if np.any(m):
                overlay[m] = (1.0 - alpha) * overlay[m] + alpha * color
        rgb_out = overlay.clip(0, 255).astype(np.uint8)
    else:
        rgb_out = base_rgb.astype(np.uint8)

    pil_img = Image.fromarray(rgb_out, mode="RGB").resize((512, 512), Image.LANCZOS)
    buf = io.BytesIO()
    pil_img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def _extract_mask_png(mask_nii_path: Path, slice_z: int) -> bytes:
    """Extract axial slice z from a 3-D prediction NIfTI and return RGBA PNG bytes.

    The mask NIfTI was saved by the MCP in (z, y, x) order (full_pred).
    Returns an RGBA image: transparent where label==0, colored where tumor present.
    Color scheme matches the MCP overlay: class 1=red, class 2=green, class 3=blue.
    """
    import nibabel as nib

    mask_img = nib.load(str(mask_nii_path))
    mask_data = np.asarray(mask_img.dataobj)  # shape (z, y, x)

    if slice_z < 0 or slice_z >= mask_data.shape[0]:
        raise ValueError(f"slice_z {slice_z} out of range for mask shape {mask_data.shape}")

    label_yx = mask_data[slice_z, :, :].astype(np.uint8)

    color_map = {
        1: np.array([255, 0, 0], dtype=np.uint8),
        2: np.array([0, 255, 0], dtype=np.uint8),
        3: np.array([0, 0, 255], dtype=np.uint8),
    }
    rgba = np.zeros((*label_yx.shape, 4), dtype=np.uint8)
    for cls, color in color_map.items():
        m = label_yx == cls
        if np.any(m):
            rgba[m, :3] = color
            rgba[m, 3] = 255  # fully opaque

    pil_img = Image.fromarray(rgba, mode="RGBA").resize((512, 512), Image.NEAREST)
    buf = io.BytesIO()
    pil_img.save(buf, "PNG")
    return buf.getvalue()


def _nifti_depth(original_url: str) -> int | None:
    """Read the z-axis depth from a NIfTI header without loading the full volume."""
    try:
        import nibabel as nib
        p = local_path_from_public_url(original_url)
        if p and p.is_file():
            img = nib.load(str(p))
            return int(img.shape[2])  # (x, y, z) — z is the axial axis
    except Exception:
        pass
    return None


def _imaging_to_response(i: Imaging) -> ImagingResponse:
    seg = normalize_docker_urls(i.segmentation_result) if i.segmentation_result else i.segmentation_result
    aligned_preview_url = seg.get("aligned_preview_url") if seg else None
    return ImagingResponse(
        id=i.id,
        patient_id=i.patient_id,
        title=i.title,
        image_type=i.image_type,
        original_url=i.original_url,
        preview_url=i.preview_url,
        group_id=i.group_id,
        segmentation_result=seg,
        slice_index=i.slice_index,
        aligned_preview_url=aligned_preview_url,
        volume_depth=_nifti_depth(i.original_url),
        created_at=i.created_at.isoformat(),
    )


@router.get("/api/patients/{patient_id}/imaging", response_model=list[ImagingResponse])
async def list_patient_imaging(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all imaging records for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    imaging_result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    imaging = imaging_result.scalars().all()

    return [_imaging_to_response(i) for i in imaging]


@router.post("/api/patients/{patient_id}/imaging", response_model=ImagingResponse)
async def create_imaging_record(
    patient_id: int,
    imaging: ImagingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create an imaging record for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_imaging = Imaging(
        patient_id=patient_id,
        title=imaging.title,
        image_type=imaging.image_type,
        original_url=imaging.original_url,
        preview_url=imaging.preview_url,
        group_id=imaging.group_id,
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)

    return _imaging_to_response(new_imaging)


@router.post("/api/patients/{patient_id}/imaging/upload", response_model=ImagingResponse)
async def upload_imaging_files(
    patient_id: int,
    preview: UploadFile = File(..., description="Preview image (JPG/PNG)"),
    volume: UploadFile = File(..., description="Original volume (.nii.gz)"),
    title: str = Form(...),
    image_type: str = Form(...),
    group_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Save preview JPG/PNG and original `.nii.gz` under `uploads/patients/{id}/` and create DB row.

    Public URLs point at `/uploads/patients/{patient_id}/...` (see `PYTHON_BACKEND_URL` / `PUBLIC_UPLOAD_BASE_URL`).
    """
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    pdir = patient_imaging_dir(patient_id)
    # Use image_type + short UUID so filenames are readable (e.g. flair_a1b2c3d4_preview.jpg)
    uid = uuid.uuid4().hex[:8]
    base = f"{image_type.lower()}_{uid}"

    prev_name = Path(preview.filename or "").name.lower()
    if prev_name.endswith((".jpg", ".jpeg")):
        preview_filename = f"{base}_preview.jpg"
    elif prev_name.endswith(".png"):
        preview_filename = f"{base}_preview.png"
    else:
        raise HTTPException(
            status_code=400,
            detail="Preview must be a .jpg, .jpeg, or .png file",
        )

    vol_name_lower = (volume.filename or "").lower()
    if vol_name_lower.endswith(".nii.gz"):
        volume_filename = f"{base}.nii.gz"
    elif vol_name_lower.endswith(".nii"):
        volume_filename = f"{base}.nii"
    else:
        raise HTTPException(
            status_code=400,
            detail="Volume must be a .nii.gz or .nii file",
        )

    preview_path = pdir / preview_filename
    volume_path = pdir / volume_filename

    try:
        with open(preview_path, "wb") as bf:
            shutil.copyfileobj(preview.file, bf)
        with open(volume_path, "wb") as bf:
            shutil.copyfileobj(volume.file, bf)
    except OSError as exc:
        logger.exception("Failed to write imaging files for patient %s", patient_id)
        raise HTTPException(status_code=500, detail=f"Failed to save files: {exc}") from exc

    rel_preview = f"patients/{patient_id}/{preview_filename}"
    rel_volume = f"patients/{patient_id}/{volume_filename}"

    new_imaging = Imaging(
        patient_id=patient_id,
        title=title,
        image_type=image_type,
        original_url=public_url_for_rel(rel_volume),
        preview_url=public_url_for_rel(rel_preview),
        group_id=group_id,
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)

    return _imaging_to_response(new_imaging)


@router.delete("/api/patients/{patient_id}/imaging/{imaging_id}")
async def delete_imaging_record(
    patient_id: int,
    imaging_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an imaging record."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging = result.scalar_one_or_none()
    
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    for url in (imaging.preview_url, imaging.original_url):
        if not url:
            continue
        lp = local_path_from_public_url(url)
        if lp and lp.is_file():
            try:
                lp.unlink()
            except OSError:
                logger.warning("Could not remove local file %s", lp)

    await db.delete(imaging)
    await db.commit()

    return {"message": "Imaging record deleted successfully"}


@router.post("/api/patients/{patient_id}/image-groups", response_model=ImageGroupResponse)
async def create_image_group(
    patient_id: int,
    group: ImageGroupCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create an image group for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_group = ImageGroup(
        patient_id=patient_id,
        name=group.name
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)

    return ImageGroupResponse(
        id=new_group.id,
        patient_id=new_group.patient_id,
        name=new_group.name,
        created_at=new_group.created_at.isoformat()
    )


@router.get("/api/patients/{patient_id}/image-groups", response_model=list[ImageGroupResponse])
async def list_image_groups(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all image groups for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    groups_result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    groups = groups_result.scalars().all()

    return [
        ImageGroupResponse(
            id=g.id,
            patient_id=g.patient_id,
            name=g.name,
            created_at=g.created_at.isoformat()
        ) for g in groups
    ]


@router.post(
    "/api/patients/{patient_id}/imaging/{imaging_id}/segment",
    response_model=ImagingResponse,
)
async def segment_imaging(
    patient_id: int,
    imaging_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Run BraTS segmentation on an imaging record's .nii.gz file via MCP.

    Sends the record's original_url (.nii.gz) to the segmentation MCP server,
    persists the full JSON output in segmentation_result, and returns the
    updated imaging record.
    """
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    if imaging_record.image_type not in _MODALITY_PARAM:
        raise HTTPException(
            status_code=400,
            detail=f"Image type '{imaging_record.image_type}' is not supported for segmentation (must be t1, t1ce, t2, or flair)",
        )

    # Reuse the stored slice if available so re-runs always use the same slice.
    # First run: -1 lets the MCP auto-select the most informative slice.
    slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

    # Collect all modalities in the same group (or all patient images if no group).
    # The BraTS segmentation model requires all 4 channels: t1, t1ce, t2, flair.
    if imaging_record.group_id is not None:
        group_result = await db.execute(
            select(Imaging)
            .where(Imaging.group_id == imaging_record.group_id)
            .where(Imaging.patient_id == patient_id)
        )
    else:
        group_result = await db.execute(
            select(Imaging).where(Imaging.patient_id == patient_id)
        )
    group_images = group_result.scalars().all()

    modality_urls = {
        img.image_type: _rewrite_for_mcp(img.original_url)
        for img in group_images
        if img.image_type in _MODALITY_PARAM
    }
    # Ensure the requested record is always included.
    if imaging_record.image_type in _MODALITY_PARAM:
        modality_urls[imaging_record.image_type] = _rewrite_for_mcp(imaging_record.original_url)

    try:
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            slice_index=slice_idx,
        )
    except Exception as exc:
        logger.exception("Segmentation MCP call failed for imaging %d", imaging_id)
        raise HTTPException(
            status_code=502,
            detail=f"Segmentation service error: {exc}",
        )

    # Add cache-busting to overlay/predmask URLs so the browser always fetches the latest file.
    ts = int(time.time())
    artifacts = segmentation_payload.get("artifacts", {})
    for key in ("overlay_image", "predmask_image", "json_summary"):
        artifact = artifacts.get(key, {})
        if "url" in artifact:
            artifact["url"] = f"{artifact['url']}?v={ts}"
    segmentation_payload["artifacts"] = artifacts

    imaging_record.segmentation_result = segmentation_payload
    # Persist the slice used so future re-runs are deterministic.
    if imaging_record.slice_index is None:
        mcp_slice = segmentation_payload.get("input", {}).get("slice_index")
        if mcp_slice is not None:
            imaging_record.slice_index = mcp_slice

    # Save aligned preview as a SEPARATE file — never touch the original preview_url.
    # The aligned preview matches the MCP overlay's orientation/slice so the two tabs align.
    # URL is embedded in segmentation_result so no schema migration is needed.
    used_slice = imaging_record.slice_index
    if used_slice is not None:
        nii_path = local_path_from_public_url(imaging_record.original_url)
        if nii_path and nii_path.is_file():
            orig_stem = nii_path.stem.replace(".nii", "")  # handle .nii.gz double ext
            aligned_filename = f"{orig_stem}_aligned_preview.jpg"
            aligned_path = nii_path.parent / aligned_filename
            if _extract_aligned_preview(nii_path, used_slice, aligned_path):
                rel = f"patients/{imaging_record.patient_id}/{aligned_filename}"
                aligned_url = f"{public_url_for_rel(rel)}?v={int(time.time())}"
                segmentation_payload["aligned_preview_url"] = aligned_url
                imaging_record.segmentation_result = segmentation_payload

    await db.commit()
    await db.refresh(imaging_record)

    return _imaging_to_response(imaging_record)


@router.post(
    "/api/patients/{patient_id}/imaging/{imaging_id}/segment-async",
    status_code=202,
)
async def segment_imaging_async(
    patient_id: int,
    imaging_id: int,
    body: SegmentAsyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start BraTS segmentation as a background task and return immediately.

    On completion:
    - If body.session_id is set: agent posts clinical interpretation to that chat session.
    - If body.user_id is set: sends an imaging.segmentation WS notification to that user.
    """
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    if imaging_record.segmentation_status == "running":
        return {"status": "already_running", "imaging_id": imaging_id}

    task = asyncio.create_task(
        _run_segmentation_background(
            patient_id=patient_id,
            imaging_id=imaging_id,
            session_id=body.session_id,
            user_id=body.user_id,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return {"status": "queued", "imaging_id": imaging_id}


@router.get("/api/patients/{patient_id}/imaging/{imaging_id}/slice")
async def get_imaging_slice(
    patient_id: int,
    imaging_id: int,
    z: int = Query(..., ge=0, description="Axial slice index"),
    overlay: bool = Query(False, description="Blend segmentation mask overlay"),
    db: AsyncSession = Depends(get_db),
):
    """Return JPEG of axial slice z for the given imaging record.

    If overlay=true and pred_mask_3d is in segmentation_result, the 3-D
    prediction mask is blended onto the slice. Falls back to raw slice when
    the mask is unavailable (pre-segmentation or legacy records).
    """
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    nii_path = local_path_from_public_url(imaging_record.original_url)
    if not nii_path or not nii_path.is_file():
        raise HTTPException(status_code=404, detail="NIfTI volume not found on disk")

    mask_path: Path | None = None
    if overlay and imaging_record.segmentation_result:
        seg = normalize_docker_urls(imaging_record.segmentation_result)
        mask_url = seg.get("artifacts", {}).get("pred_mask_3d", {}).get("url", "")
        if mask_url:
            mask_path = local_path_from_public_url(mask_url.split("?")[0])

    try:
        jpeg_bytes = await asyncio.get_event_loop().run_in_executor(
            None, _extract_slice_jpeg, nii_path, z, mask_path
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Slice extraction failed z=%d %s", z, nii_path)
        raise HTTPException(status_code=500, detail="Slice extraction failed")

    return Response(content=jpeg_bytes, media_type="image/jpeg")


@router.get("/api/patients/{patient_id}/imaging/{imaging_id}/mask")
async def get_imaging_mask(
    patient_id: int,
    imaging_id: int,
    z: int = Query(..., ge=0, description="Axial slice index"),
    db: AsyncSession = Depends(get_db),
):
    """Return RGBA PNG of the segmentation mask at axial slice z.

    Transparent where no tumor is predicted; red/green/blue for classes 1/2/3.
    Requires segmentation to have been run (pred_mask_3d must exist).
    """
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging_record = result.scalar_one_or_none()
    if not imaging_record:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    if not imaging_record.segmentation_result:
        raise HTTPException(status_code=404, detail="No segmentation result available")

    seg = normalize_docker_urls(imaging_record.segmentation_result)
    mask_url = seg.get("artifacts", {}).get("pred_mask_3d", {}).get("url", "")
    if not mask_url:
        raise HTTPException(status_code=404, detail="3D mask not found in segmentation result")

    mask_path = local_path_from_public_url(mask_url.split("?")[0])
    if not mask_path or not mask_path.is_file():
        raise HTTPException(status_code=404, detail="3D mask file not found on disk")

    try:
        png_bytes = await asyncio.get_event_loop().run_in_executor(
            None, _extract_mask_png, mask_path, z
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Mask extraction failed z=%d %s", z, mask_path)
        raise HTTPException(status_code=500, detail="Mask extraction failed")

    return Response(content=png_bytes, media_type="image/png")
