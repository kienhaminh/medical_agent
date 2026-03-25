"""Tests for the Department model."""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.department import Department


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
