"""Unit tests for CaseThread and CaseMessage models."""
import uuid
import pytest
from src.models.case_thread import CaseThread, CaseMessage


@pytest.mark.asyncio
async def test_create_case_thread(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Patient with chest pain and dyspnea.",
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    assert thread.id is not None
    assert thread.patient_id == sample_patient.id
    assert thread.status == "open"
    assert thread.max_rounds == 3
    assert thread.current_round == 0
    assert thread.synthesis is None


@pytest.mark.asyncio
async def test_create_case_message(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="auto",
        case_summary="Shortness of breath.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="specialist",
        specialist_role="cardiologist",
        content="I recommend an ECG.",
        agrees_with=None,
        challenges=None,
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.id is not None
    assert msg.thread_id == thread.id
    assert msg.round == 1
    assert msg.specialist_role == "cardiologist"


@pytest.mark.asyncio
async def test_chief_message(db_session, sample_patient):
    thread = CaseThread(
        id=str(uuid.uuid4()),
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Altered mental status.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="chief",
        specialist_role=None,
        content="Neurologist, please address the stroke risk directly.",
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    assert msg.sender_type == "chief"
    assert msg.specialist_role is None


@pytest.mark.asyncio
async def test_messages_cascade_delete(db_session, sample_patient):
    thread_id = str(uuid.uuid4())
    thread = CaseThread(
        id=thread_id,
        patient_id=sample_patient.id,
        created_by="doctor:session_1",
        trigger="manual",
        case_summary="Chest pain.",
    )
    db_session.add(thread)
    await db_session.commit()

    msg = CaseMessage(
        id=str(uuid.uuid4()),
        thread_id=thread.id,
        round=1,
        sender_type="specialist",
        specialist_role="internist",
        content="Initial assessment.",
    )
    db_session.add(msg)
    await db_session.commit()

    await db_session.delete(thread)
    await db_session.commit()

    from sqlalchemy import select
    result = await db_session.execute(
        select(CaseMessage).where(CaseMessage.thread_id == thread_id)
    )
    assert result.scalars().all() == []
