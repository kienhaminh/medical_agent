"""Patient imaging operations."""
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, Imaging, ImageGroup
from src.tools.medical_img_segmentation_tool import _call_segmentation_mcp
from src.utils.upload_storage import (
    local_path_from_public_url,
    patient_imaging_dir,
    public_url_for_rel,
)
from ...models import ImagingResponse, ImageGroupResponse, ImageGroupCreate, ImagingCreate

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])


def _imaging_to_response(i: Imaging) -> ImagingResponse:
    return ImagingResponse(
        id=i.id,
        patient_id=i.patient_id,
        title=i.title,
        image_type=i.image_type,
        original_url=i.original_url,
        preview_url=i.preview_url,
        group_id=i.group_id,
        segmentation_result=i.segmentation_result,
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
    stem = uuid.uuid4().hex

    prev_name = Path(preview.filename or "").name.lower()
    if prev_name.endswith((".jpg", ".jpeg")):
        preview_filename = f"{stem}_preview.jpg"
    elif prev_name.endswith(".png"):
        preview_filename = f"{stem}_preview.png"
    else:
        raise HTTPException(
            status_code=400,
            detail="Preview must be a .jpg, .jpeg, or .png file",
        )

    vol_name_lower = (volume.filename or "").lower()
    if vol_name_lower.endswith(".nii.gz"):
        volume_filename = f"{stem}_volume.nii.gz"
    elif vol_name_lower.endswith(".nii"):
        volume_filename = f"{stem}_volume.nii"
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

    try:
        segmentation_payload = await _call_segmentation_mcp(
            image_url=imaging_record.original_url,
            patient_id=str(patient_id),
        )
    except Exception as exc:
        logger.exception("Segmentation MCP call failed for imaging %d", imaging_id)
        raise HTTPException(
            status_code=502,
            detail=f"Segmentation service error: {exc}",
        )

    imaging_record.segmentation_result = segmentation_payload
    await db.commit()
    await db.refresh(imaging_record)

    return _imaging_to_response(imaging_record)
