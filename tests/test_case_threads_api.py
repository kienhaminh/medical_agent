# tests/test_case_threads_api.py
"""Integration tests for GET /api/case-threads/{thread_id}."""
import uuid
import pytest
import pytest_asyncio
from datetime import date
from httpx import AsyncClient, ASGITransport

from src.api.server import app
from src.models.case_thread import CaseThread, CaseMessage
from src.models.patient import Patient
from src.models.base import AsyncSessionLocal


@pytest_asyncio.fixture
async def thread_in_db():
    """Create a patient + CaseThread with two messages directly in the DB; clean up after."""
    patient_id = None
    thread_id = str(uuid.uuid4())

    async with AsyncSessionLocal() as db:
        patient = Patient(name="Test Patient", dob=date(1980, 1, 1), gender="male")
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        patient_id = patient.id

        thread = CaseThread(
            id=thread_id,
            patient_id=patient_id,
            created_by="doctor:test",
            trigger="manual",
            status="converged",
            case_summary="Patient with chest pain.",
            synthesis="PRIMARY RECOMMENDATION: Start aspirin.",
        )
        db.add(thread)
        await db.commit()

        db.add(CaseMessage(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            round=1,
            sender_type="specialist",
            specialist_role="cardiologist",
            content="ECG shows ST elevation.",
        ))
        db.add(CaseMessage(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            round=1,
            sender_type="specialist",
            specialist_role="internist",
            content="Agree with cardiologist.",
        ))
        db.add(CaseMessage(
            id=str(uuid.uuid4()),
            thread_id=thread_id,
            round=2,
            sender_type="specialist",
            specialist_role="internist",
            content="Confirming recommendation after chief directive.",
        ))
        await db.commit()

    yield thread_id

    # Teardown — explicitly delete messages, then thread, then patient
    from sqlalchemy import delete
    async with AsyncSessionLocal() as db:
        await db.execute(delete(CaseMessage).where(CaseMessage.thread_id == thread_id))
        await db.execute(delete(CaseThread).where(CaseThread.id == thread_id))
        if patient_id:
            await db.execute(delete(Patient).where(Patient.id == patient_id))
        await db.commit()


@pytest.mark.asyncio
async def test_get_case_thread_returns_thread_and_messages(thread_in_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{thread_in_db}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == thread_in_db
    assert data["status"] == "converged"
    assert data["synthesis"] == "PRIMARY RECOMMENDATION: Start aspirin."
    assert len(data["messages"]) == 3
    roles = {m["specialist_role"] for m in data["messages"]}
    assert "cardiologist" in roles
    assert "internist" in roles


@pytest.mark.asyncio
async def test_get_case_thread_404_for_missing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_messages_ordered_by_round(thread_in_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/case-threads/{thread_in_db}")
    data = resp.json()
    rounds = [m["round"] for m in data["messages"]]
    # Fixture has 2 round-1 messages then 1 round-2 message — verify ordering
    assert rounds == sorted(rounds)
    assert rounds[-1] == 2
