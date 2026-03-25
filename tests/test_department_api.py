# tests/test_department_api.py
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from src.models.department import Department
from src.models.base import get_db


@pytest_asyncio.fixture
async def client(db_session):
    @asynccontextmanager
    async def mock_lifespan(app):
        yield

    with patch("src.api.server.lifespan", mock_lifespan):
        from src.api.server import app

        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_departments(db_session):
    from src.constants.department_seed_data import DEPARTMENT_SEED_DATA
    for data in DEPARTMENT_SEED_DATA:
        dept = Department(**data, is_open=True)
        db_session.add(dept)
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_departments(client, seeded_departments):
    response = await client.get("/api/departments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 14
    cardio = next(d for d in data if d["name"] == "cardiology")
    assert cardio["capacity"] == 4
    assert cardio["status"] == "IDLE"
    assert cardio["current_patient_count"] == 0


@pytest.mark.asyncio
async def test_update_department(client, seeded_departments):
    response = await client.patch(
        "/api/departments/cardiology",
        json={"capacity": 8, "is_open": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["capacity"] == 8
    assert data["is_open"] is False


@pytest.mark.asyncio
async def test_update_nonexistent_department(client, seeded_departments):
    response = await client.patch(
        "/api/departments/fake_dept",
        json={"capacity": 5},
    )
    assert response.status_code == 404
