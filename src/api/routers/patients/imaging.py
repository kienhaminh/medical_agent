"""Patient imaging operations."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, Imaging, ImageGroup
from ...models import ImagingResponse, ImageGroupResponse, ImageGroupCreate, ImagingCreate

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])


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

    return [
        ImagingResponse(
            id=i.id,
            patient_id=i.patient_id,
            title=i.title,
            image_type=i.image_type,
            original_url=i.original_url,
            preview_url=i.preview_url,
            created_at=i.created_at.isoformat()
        ) for i in imaging
    ]


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
        preview_url=imaging.preview_url
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)

    return ImagingResponse(
        id=new_imaging.id,
        patient_id=new_imaging.patient_id,
        title=new_imaging.title,
        image_type=new_imaging.image_type,
        original_url=new_imaging.original_url,
        preview_url=new_imaging.preview_url,
        created_at=new_imaging.created_at.isoformat()
    )


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
