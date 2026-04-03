"""Integration tests for the visit tracking API."""
import pytest
import pytest_asyncio
from datetime import date
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus
from src.models.visit_step import VisitStep, StepStatus
from src.models.patient import Patient


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def tracked_visit(db_session):
    """A visit with 3 itinerary steps: Registration(done), ENT(active), Lab(pending)."""
    dept = Department(name="ent", label="ENT", capacity=4, is_open=True,
                      color="#3b82f6", icon="Ear")
    db_session.add(dept)
    patient = Patient(name="Jordan Park", dob=date(1988, 11, 15), gender="male")
    db_session.add(patient)
    await db_session.flush()

    visit = Visit(
        visit_id="VIS-20260403-099",
        patient_id=patient.id,
        status=VisitStatus.IN_DEPARTMENT.value,
        current_department="ent",
        queue_position=1,
        chief_complaint="Ear pain",
        assigned_doctor="Dr. Nguyen",
        clinical_notes="Mild congestion",
        urgency_level="routine",
    )
    db_session.add(visit)
    await db_session.flush()

    steps = [
        VisitStep(visit_id=visit.id, step_order=1, label="Registration & Intake",
                  status=StepStatus.DONE.value, department=None),
        VisitStep(visit_id=visit.id, step_order=2, label="ENT Department",
                  description="Ear exam", room="Room 204",
                  department="ent", status=StepStatus.ACTIVE.value),
        VisitStep(visit_id=visit.id, step_order=3, label="Blood Test Lab",
                  description="CBC panel", room="Lab A",
                  department=None, status=StepStatus.PENDING.value),
    ]
    for s in steps:
        db_session.add(s)
    await db_session.commit()
    return visit


@pytest.mark.asyncio
async def test_track_endpoint_returns_visit_data(client, tracked_visit):
    resp = await client.get(f"/api/visits/{tracked_visit.id}/track")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visit_id"] == "VIS-20260403-099"
    assert data["patient_name"] == "Jordan Park"
    assert data["chief_complaint"] == "Ear pain"
    assert data["assigned_doctor"] == "Dr. Nguyen"
    assert data["urgency_level"] == "routine"
    assert data["queue_position"] == 1


@pytest.mark.asyncio
async def test_track_endpoint_returns_steps_in_order(client, tracked_visit):
    resp = await client.get(f"/api/visits/{tracked_visit.id}/track")
    assert resp.status_code == 200
    steps = resp.json()["steps"]
    assert len(steps) == 3
    assert steps[0]["status"] == "done"
    assert steps[1]["status"] == "active"
    assert steps[1]["label"] == "ENT Department"
    assert steps[2]["status"] == "pending"


@pytest.mark.asyncio
async def test_track_endpoint_returns_empty_steps_when_none(client, db_session):
    patient = Patient(name="No Steps", dob=date(1990, 1, 1), gender="male")
    db_session.add(patient)
    await db_session.flush()
    visit = Visit(visit_id="VIS-20260403-100", patient_id=patient.id,
                  status=VisitStatus.IN_DEPARTMENT.value, current_department="ent",
                  queue_position=1)
    db_session.add(visit)
    await db_session.commit()
    resp = await client.get(f"/api/visits/{visit.id}/track")
    assert resp.status_code == 200
    assert resp.json()["steps"] == []


@pytest.mark.asyncio
async def test_track_endpoint_404_for_unknown_visit(client):
    resp = await client.get("/api/visits/9999/track")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_step_complete_marks_done_and_advances(client, tracked_visit, db_session):
    from sqlalchemy import select
    result = await db_session.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == tracked_visit.id)
        .where(VisitStep.step_order == 2)
    )
    active_step = result.scalar_one()

    resp = await client.patch(
        f"/api/visits/{tracked_visit.id}/steps/{active_step.id}/complete"
    )
    assert resp.status_code == 200

    await db_session.refresh(active_step)
    assert active_step.status == StepStatus.DONE.value
    assert active_step.completed_at is not None

    result3 = await db_session.execute(
        select(VisitStep)
        .where(VisitStep.visit_id == tracked_visit.id)
        .where(VisitStep.step_order == 3)
    )
    next_step = result3.scalar_one()
    assert next_step.status == StepStatus.ACTIVE.value


@pytest.mark.asyncio
async def test_step_complete_404_for_unknown_step(client, tracked_visit):
    resp = await client.patch(f"/api/visits/{tracked_visit.id}/steps/9999/complete")
    assert resp.status_code == 404
