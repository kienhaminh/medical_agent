# tests/eval/test_intake_simulator.py
import pytest
from unittest.mock import AsyncMock
from eval.api_client import ChatEvent
from eval.case_loader import EvalCase, PatientProfile, IntakeScript, CaseExpected, TriageExpectation
from eval.intake_simulator import IntakeSimulator, TriageResult


def _make_case(turns: list[str]) -> EvalCase:
    return EvalCase(
        id="sim-test-001",
        description="Test",
        patient=PatientProfile(name="John", age=55, sex="male"),
        intake=IntakeScript(turns=turns),
        expected=CaseExpected(triage=TriageExpectation(department="Cardiology")),
    )


def _make_event(content: str = "", tool_calls: list | None = None, session_id: int | None = None) -> ChatEvent:
    event = ChatEvent()
    event.chunks = [content] if content else []
    event.tool_calls = tool_calls or []
    event.session_id = session_id
    return event


@pytest.mark.asyncio
async def test_run_detects_complete_triage_tool_call():
    """run() returns TriageResult when complete_triage appears in tool_calls."""
    triage_tool_call = {
        "name": "complete_triage",
        "args": {"department": "Cardiology", "confidence": 0.88, "visit_id": 99},
    }
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("Tell me more", session_id=10),
        _make_event("Routing you now", tool_calls=[triage_tool_call], session_id=10),
    ]

    case = _make_case(turns=["I have chest pain", "It's crushing"])
    sim = IntakeSimulator(client=mock_client)
    result = await sim.run(case, patient_id=5)

    assert isinstance(result, TriageResult)
    assert result.department == "Cardiology"
    assert result.confidence == 0.88
    assert result.visit_id == 99
    assert result.session_id == 10
    assert len(result.agent_responses) == 2


@pytest.mark.asyncio
async def test_run_returns_none_department_when_triage_not_completed():
    """run() returns TriageResult with None department if complete_triage never fires."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("Please describe your symptoms", session_id=5)

    case = _make_case(turns=["I feel bad"])
    sim = IntakeSimulator(client=mock_client)
    result = await sim.run(case, patient_id=3)

    assert result.department is None
    assert result.confidence is None
    assert result.visit_id is None


@pytest.mark.asyncio
async def test_run_passes_patient_id_and_mode_to_chat():
    """run() sends patient_id and mode='intake' to every chat call."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("ok")

    case = _make_case(turns=["Hello", "I feel sick"])
    sim = IntakeSimulator(client=mock_client)
    await sim.run(case, patient_id=7)

    for call in mock_client.chat.call_args_list:
        assert call.kwargs.get("patient_id") == 7
        assert call.kwargs.get("mode") == "intake"


@pytest.mark.asyncio
async def test_run_reuses_session_id_across_turns():
    """run() passes the session_id from the first response into subsequent calls."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("First response", session_id=99),
        _make_event("Second response"),
    ]

    case = _make_case(turns=["turn 1", "turn 2"])
    sim = IntakeSimulator(client=mock_client)
    await sim.run(case, patient_id=1)

    second_call_kwargs = mock_client.chat.call_args_list[1].kwargs
    assert second_call_kwargs.get("session_id") == 99
