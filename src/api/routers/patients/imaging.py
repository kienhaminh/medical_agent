"""Patient imaging operations."""
import asyncio
import logging
import uuid

from fastapi import APIRouter, HTTPException, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, Imaging, ImageGroup
from src.tools.medical_img_segmentation_tool import (
    _call_segmentation_mcp,
    _rewrite_for_mcp,
    _MODALITY_PARAM,
)
from src.utils.upload_storage import upload_bytes, public_url_for_rel, patient_rel_path
from pydantic import BaseModel, model_validator

from ...models import ImagingResponse, ImageGroupResponse, ImageGroupCreate, ImagingCreate
from src.api.routers.patients.segmentation_worker import _run_segmentation_background

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])

# Strong reference set to prevent asyncio background tasks from being garbage-collected
_background_tasks: set[asyncio.Task] = set()


class SegmentAsyncRequest(BaseModel):
    """Body for the non-blocking segment-async endpoint."""
    user_id: str | None = None
    session_id: int | None = None

    @model_validator(mode="after")
    def require_at_least_one(self) -> "SegmentAsyncRequest":
        if self.user_id is None and self.session_id is None:
            raise ValueError("At least one of user_id or session_id must be provided")
        return self


def _imaging_to_response(i: Imaging) -> ImagingResponse:
    """Convert Imaging ORM to ImagingResponse. volume_depth comes from segmentation result."""
    seg = i.segmentation_result
    volume_depth: int | None = None
    if seg and isinstance(seg.get("input", {}).get("shape_zyx"), list):
        shape = seg["input"]["shape_zyx"]
        if shape:
            volume_depth = int(shape[0])
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
        aligned_preview_url=None,
        volume_depth=volume_depth,
        created_at=i.created_at.isoformat(),
    )


@router.get("/api/patients/{patient_id}/imaging", response_model=list[ImagingResponse])
async def list_patient_imaging(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all imaging records for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    imaging_result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    return [_imaging_to_response(i) for i in imaging_result.scalars().all()]


@router.post("/api/patients/{patient_id}/imaging", response_model=ImagingResponse)
async def create_imaging_record(
    patient_id: int,
    imaging: ImagingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an imaging record with pre-supplied URLs (no file upload)."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
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
    """Upload preview JPG and .nii.gz NIfTI to Supabase Storage and create DB row."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    uid = uuid.uuid4().hex[:8]
    base = f"{image_type.lower()}_{uid}"

    # Validate and name preview file
    prev_name = (preview.filename or "").lower()
    if prev_name.endswith((".jpg", ".jpeg")):
        preview_filename = f"{base}_preview.jpg"
        preview_content_type = "image/jpeg"
    elif prev_name.endswith(".png"):
        preview_filename = f"{base}_preview.png"
        preview_content_type = "image/png"
    else:
        raise HTTPException(status_code=400, detail="Preview must be .jpg, .jpeg, or .png")

    # Validate and name volume file
    vol_name = (volume.filename or "").lower()
    if vol_name.endswith(".nii.gz"):
        volume_filename = f"{base}.nii.gz"
    elif vol_name.endswith(".nii"):
        volume_filename = f"{base}.nii"
    else:
        raise HTTPException(status_code=400, detail="Volume must be .nii.gz or .nii")

    # Read and upload both files to Supabase Storage
    try:
        preview_bytes = await preview.read()
        preview_url = upload_bytes(
            patient_rel_path(patient_id, preview_filename),
            preview_bytes,
            preview_content_type,
        )

        volume_bytes = await volume.read()
        volume_url = upload_bytes(
            patient_rel_path(patient_id, volume_filename),
            volume_bytes,
            "application/gzip",
        )
    except Exception as exc:
        logger.exception("Failed to upload imaging files for patient %s", patient_id)
        raise HTTPException(status_code=500, detail=f"Upload to storage failed: {exc}") from exc

    new_imaging = Imaging(
        patient_id=patient_id,
        title=title,
        image_type=image_type,
        original_url=volume_url,
        preview_url=preview_url,
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
    db: AsyncSession = Depends(get_db),
):
    """Delete an imaging record (DB row only; Supabase objects are retained)."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging = result.scalar_one_or_none()
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    await db.delete(imaging)
    await db.commit()
    return {"message": "Imaging record deleted successfully"}


@router.post("/api/patients/{patient_id}/image-groups", response_model=ImageGroupResponse)
async def create_image_group(
    patient_id: int,
    group: ImageGroupCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an image group for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_group = ImageGroup(patient_id=patient_id, name=group.name)
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return ImageGroupResponse(
        id=new_group.id,
        patient_id=new_group.patient_id,
        name=new_group.name,
        created_at=new_group.created_at.isoformat(),
    )


@router.get("/api/patients/{patient_id}/image-groups", response_model=list[ImageGroupResponse])
async def list_image_groups(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all image groups for a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    groups_result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    return [
        ImageGroupResponse(
            id=g.id,
            patient_id=g.patient_id,
            name=g.name,
            created_at=g.created_at.isoformat(),
        )
        for g in groups_result.scalars().all()
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
    """Run BraTS segmentation synchronously via MCP and persist result."""
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
            detail=f"Image type '{imaging_record.image_type}' not supported for segmentation",
        )

    slice_idx = imaging_record.slice_index if imaging_record.slice_index is not None else -1

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
    modality_urls[imaging_record.image_type] = _rewrite_for_mcp(imaging_record.original_url)

    try:
        segmentation_payload = await _call_segmentation_mcp(
            modality_urls=modality_urls,
            patient_id=str(patient_id),
            imaging_id=str(imaging_id),
            slice_index=slice_idx,
        )
    except Exception as exc:
        logger.exception("Segmentation MCP call failed for imaging %d", imaging_id)
        raise HTTPException(status_code=502, detail=f"Segmentation service error: {exc}")

    imaging_record.segmentation_result = segmentation_payload
    if imaging_record.slice_index is None:
        mcp_slice = segmentation_payload.get("input", {}).get("slice_index")
        if mcp_slice is not None:
            imaging_record.slice_index = mcp_slice

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
    """Start BraTS segmentation as a background task and return immediately."""
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
