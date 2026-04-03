# tests/test_rooms_api.py
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from src.models.base import get_db
from src.models.department import Department
from src.models.room import Room


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
async def seeded_dept(db_session):
    dept = Department(
        name="ent",
        label="ENT Department",
        capacity=4,
        is_open=True,
        color="#6366f1",
        icon="Ear",
    )
    db_session.add(dept)
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_rooms_empty(client, seeded_dept):
    response = await client.get("/api/rooms")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_room(client, seeded_dept):
    response = await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    assert response.status_code == 201
    data = response.json()
    assert data["room_number"] == "101"
    assert data["department_name"] == "ent"
    assert data["current_visit_id"] is None
    assert data["patient_name"] is None


@pytest.mark.asyncio
async def test_create_room_duplicate_fails(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    response = await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_rooms_returns_created(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    await client.post("/api/rooms", json={"room_number": "102", "department_name": "ent"})
    response = await client.get("/api/rooms")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    numbers = [r["room_number"] for r in data]
    assert "101" in numbers
    assert "102" in numbers


@pytest.mark.asyncio
async def test_patch_room_assign_visit(client, seeded_dept, db_session):
    from datetime import date
    from src.models.patient import Patient
    from src.models.visit import Visit, VisitStatus

    patient = Patient(name="John Doe", dob=date(1980, 1, 1), gender="M")
    db_session.add(patient)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-TEST-001",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="ear pain",
    )
    db_session.add(visit)
    await db_session.flush()

    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})

    response = await client.patch("/api/rooms/101", json={"current_visit_id": visit.id})
    assert response.status_code == 200
    data = response.json()
    assert data["current_visit_id"] == visit.id
    assert data["patient_name"] == "John Doe"


@pytest.mark.asyncio
async def test_patch_room_unassign(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    response = await client.patch("/api/rooms/101", json={"current_visit_id": None})
    assert response.status_code == 200
    assert response.json()["current_visit_id"] is None


@pytest.mark.asyncio
async def test_patch_room_assign_nonexistent_visit(client, seeded_dept):
    await client.post("/api/rooms", json={"room_number": "101", "department_name": "ent"})
    response = await client.patch("/api/rooms/101", json={"current_visit_id": 99999})
    assert response.status_code == 404
