"""Unit tests for MedicalRecord model."""
import pytest
from sqlalchemy import select

from src.models import MedicalRecord


@pytest.mark.asyncio
async def test_create_medical_record(db_session, sample_patient):
    """Test creating a medical record."""
    record = MedicalRecord(
        patient_id=sample_patient.id,
        record_type="text",
        content="Patient has fever",
        summary="Fever symptoms"
    )
    db_session.add(record)
    await db_session.commit()
    await db_session.refresh(record)
    
    assert record.id is not None
    assert record.patient_id == sample_patient.id
    assert record.record_type == "text"
    assert record.content == "Patient has fever"
    assert record.summary == "Fever symptoms"


@pytest.mark.asyncio
async def test_get_medical_record(db_session, sample_medical_record):
    """Test retrieving a medical record."""
    result = await db_session.execute(
        select(MedicalRecord).where(MedicalRecord.id == sample_medical_record.id)
    )
    record = result.scalar_one_or_none()
    
    assert record is not None
    assert record.content == "Patient reports headaches"


@pytest.mark.asyncio
async def test_delete_medical_record(db_session, sample_medical_record):
    """Test deleting a medical record."""
    record_id = sample_medical_record.id
    
    await db_session.delete(sample_medical_record)
    await db_session.commit()
    
    result = await db_session.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    
    assert record is None
