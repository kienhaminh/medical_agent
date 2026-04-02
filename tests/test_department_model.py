"""Tests for the Department model."""
import pytest
import pytest_asyncio
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def sample_department(db_session: AsyncSession) -> Department:
    dept = Department(
        name="cardiology",
        label="Cardiology",
        capacity=4,
        is_open=True,
        color="#10b981",
        icon="Heart",
    )
    db_session.add(dept)
    await db_session.commit()
    await db_session.refresh(dept)
    return dept


@pytest.mark.asyncio
async def test_department_creation(sample_department: Department):
    assert sample_department.id is not None
    assert sample_department.name == "cardiology"
    assert sample_department.label == "Cardiology"
    assert sample_department.capacity == 4
    assert sample_department.is_open is True
    assert sample_department.color == "#10b981"
    assert sample_department.icon == "Heart"


@pytest.mark.asyncio
async def test_department_name_is_unique(db_session: AsyncSession, sample_department: Department):
    duplicate = Department(
        name="cardiology",
        label="Cardiology Duplicate",
        capacity=2,
        is_open=True,
        color="#000",
        icon="Heart",
    )
    db_session.add(duplicate)
    with pytest.raises(Exception):  # IntegrityError
        await db_session.commit()


@pytest_asyncio.fixture
async def sample_patient(db_session: AsyncSession) -> Patient:
    patient = Patient(name="Test Patient", dob=date(1990, 1, 1), gender="male")
    db_session.add(patient)
    await db_session.commit()
    await db_session.refresh(patient)
    return patient


@pytest.mark.asyncio
async def test_visit_current_department_field(
    db_session: AsyncSession, sample_patient: Patient, sample_department: Department
):
    visit = Visit(
        visit_id="VIS-20260325-001",
        patient_id=sample_patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=1,
    )
    db_session.add(visit)
    await db_session.commit()
    await db_session.refresh(visit)
    assert visit.current_department == "cardiology"
    assert visit.queue_position == 1


@pytest.mark.asyncio
async def test_visit_current_department_nullable(
    db_session: AsyncSession, sample_patient: Patient
):
    visit = Visit(
        visit_id="VIS-20260325-002",
        patient_id=sample_patient.id,
        status=VisitStatus.INTAKE.value,
    )
    db_session.add(visit)
    await db_session.commit()
    await db_session.refresh(visit)
    assert visit.current_department is None
    assert visit.queue_position is None
