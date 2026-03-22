"""Patient medical records operations."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, MedicalRecord
from ..models import RecordResponse, TextRecordCreate

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])


@router.get("/api/patients/{patient_id}/records", response_model=list[RecordResponse])
async def list_patient_records(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all medical records for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    records_result = await db.execute(
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc())
    )
    records = records_result.scalars().all()

    return [
        RecordResponse(
            id=r.id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            content=r.content,
            summary=r.summary,
            created_at=r.created_at.isoformat()
        ) for r in records
    ]


@router.post("/api/patients/{patient_id}/records", response_model=RecordResponse)
async def create_text_record(
    patient_id: int, 
    record: TextRecordCreate, 
    db: AsyncSession = Depends(get_db)
):
    """Create a text medical record for a patient."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type="text",
        content=record.content,
        summary=record.summary
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)

    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        content=new_record.content,
        summary=new_record.summary,
        created_at=new_record.created_at.isoformat()
    )


@router.delete("/api/records/{record_id}")
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a medical record."""
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await db.delete(record)
    await db.commit()
    
    return {"message": "Record deleted successfully"}
