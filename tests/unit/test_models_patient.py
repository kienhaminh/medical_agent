"""Unit tests for Patient model."""
import pytest
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.models import Patient, MedicalRecord


@pytest.mark.asyncio
async def test_create_patient(db_session):
    """Test creating a patient."""
    patient = Patient(
        name="Jane Smith",
        dob=date(1985, 5, 15),
        gender="female"
    )
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    
    assert patient.id is not None
    assert patient.name == "Jane Smith"
    assert patient.dob == date(1985, 5, 15)
    assert patient.gender == "female"


@pytest.mark.asyncio
async def test_get_patient(db_session, sample_patient):
    """Test retrieving a patient."""
    result = await db_session.execute(
        select(Patient).where(Patient.id == sample_patient.id)
    )
    patient = result.scalar_one_or_none()
    
    assert patient is not None
    assert patient.name == "John Doe"


@pytest.mark.asyncio
async def test_update_patient(db_session, sample_patient):
    """Test updating a patient."""
    sample_patient.name = "John Updated"
    await db_session.commit()
    await db_session.refresh(sample_patient)
    
    assert sample_patient.name == "John Updated"


@pytest.mark.asyncio
async def test_delete_patient(db_session, sample_patient):
    """Test deleting a patient."""
    patient_id = sample_patient.id
    
    await db_session.delete(sample_patient)
    await db_session.commit()
    
    result = await db_session.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    
    assert patient is None


@pytest.mark.asyncio
async def test_patient_records_relationship(db_session, sample_patient, sample_medical_record):
    """Test patient to medical records relationship."""
    result = await db_session.execute(
        select(Patient).where(Patient.id == sample_patient.id).options(selectinload(Patient.records))
    )
    patient = result.scalar_one()

    # Check that patient has records
    assert len(patient.records) >= 1
    assert patient.records[0].content == "Patient reports headaches"
