import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from src.api.server import app
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def setup_transfer(db_session):
    cardio = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    radiology = Department(name="radiology", label="Radiology", capacity=5, is_open=True, color="#f59e0b", icon="Scan")
    closed_dept = Department(name="ent", label="ENT", capacity=2, is_open=False, color="#fb923c", icon="Ear")
    db_session.add_all([cardio, radiology, closed_dept])
    patient = Patient(name="John Doe", dob="1990-01-01", gender="male")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(
        visit_id="VIS-20260325-001",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="cardiology",
        queue_position=1,
    )
    db_session.add(visit)
    await db_session.commit()
    return visit


@pytest.mark.asyncio
async def test_transfer_success(client, setup_transfer):
    visit = setup_transfer
    response = await client.post(f"/api/visits/{visit.id}/transfer", json={"target_department": "radiology"})
    assert response.status_code == 200
    data = response.json()
    assert data["current_department"] == "radiology"


@pytest.mark.asyncio
async def test_transfer_to_closed_department(client, setup_transfer):
    visit = setup_transfer
    response = await client.post(f"/api/visits/{visit.id}/transfer", json={"target_department": "ent"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_transfer_to_full_department(client, db_session, setup_transfer):
    visit = setup_transfer
    patient = (await db_session.execute(select(Patient).limit(1))).scalar_one()
    for i in range(5):
        v = Visit(visit_id=f"VIS-20260325-1{i:02d}", patient_id=patient.id,
                  status=VisitStatus.IN_DEPARTMENT.value, current_department="radiology", queue_position=i+1)
        db_session.add(v)
    await db_session.commit()
    response = await client.post(f"/api/visits/{visit.id}/transfer", json={"target_department": "radiology"})
    assert response.status_code == 400
    assert "capacity" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_transfer_non_department_visit(client, db_session):
    patient = Patient(name="Jane Doe", dob="1985-05-15", gender="female")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(visit_id="VIS-20260325-002", patient_id=patient.id, status=VisitStatus.INTAKE.value)
    db_session.add(visit)
    await db_session.commit()
    response = await client.post(f"/api/visits/{visit.id}/transfer", json={"target_department": "radiology"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_check_in_sets_current_department(client, db_session):
    dept = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    db_session.add(dept)
    patient = Patient(name="Alice", dob="1992-03-15", gender="female")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(visit_id="VIS-20260325-010", patient_id=patient.id,
                  status=VisitStatus.ROUTED.value, routing_decision=["cardiology"])
    db_session.add(visit)
    await db_session.commit()
    response = await client.patch(f"/api/visits/{visit.id}/check-in")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_department"
    assert data["current_department"] == "cardiology"
    assert data["queue_position"] == 1


@pytest.mark.asyncio
async def test_complete_clears_department_and_compacts(client, db_session):
    dept = Department(name="cardiology", label="Cardiology", capacity=4, is_open=True, color="#10b981", icon="Heart")
    db_session.add(dept)
    patient = Patient(name="Bob", dob="1985-07-20", gender="male")
    db_session.add(patient)
    await db_session.flush()
    visit1 = Visit(visit_id="VIS-20260325-020", patient_id=patient.id,
                   status=VisitStatus.IN_DEPARTMENT.value, current_department="cardiology", queue_position=1)
    visit2 = Visit(visit_id="VIS-20260325-021", patient_id=patient.id,
                   status=VisitStatus.IN_DEPARTMENT.value, current_department="cardiology", queue_position=2)
    db_session.add_all([visit1, visit2])
    await db_session.commit()
    response = await client.patch(f"/api/visits/{visit1.id}/complete")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["current_department"] is None
    assert data["queue_position"] is None
    await db_session.refresh(visit2)
    assert visit2.queue_position == 1
