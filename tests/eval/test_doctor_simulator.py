# tests/eval/test_doctor_simulator.py
import pytest
from unittest.mock import AsyncMock
from eval.api_client import ChatEvent
from eval.doctor_simulator import DoctorSimulator, DoctorResult


def _make_event(content: str, session_id: int | None = None) -> ChatEvent:
    event = ChatEvent()
    event.chunks = [content]
    event.session_id = session_id
    return event


@pytest.mark.asyncio
async def test_run_returns_doctor_result_with_all_outputs():
    """run() calls chat 3 times and returns DDx, history, and SOAP outputs."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("1. Acute MI (I21.9) - High\n2. Unstable Angina (I20.0) - Medium", session_id=20),
        _make_event("Chief Concerns: Chest pain\nRed Flags: Hypertension", session_id=20),
        _make_event("S: Patient reports crushing chest pain\nO: BP 150/90\nA: Likely ACS\nP: ECG, troponin", session_id=20),
    ]

    sim = DoctorSimulator(client=mock_client)
    result = await sim.run(patient_id=5, visit_id=10)

    assert isinstance(result, DoctorResult)
    assert "Acute MI" in result.ddx_output
    assert "Chief Concerns" in result.history_output
    assert "S:" in result.soap_output
    assert mock_client.chat.call_count == 3


@pytest.mark.asyncio
async def test_run_passes_patient_and_visit_id():
    """run() includes patient_id and visit_id in all chat calls."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("output")

    sim = DoctorSimulator(client=mock_client)
    await sim.run(patient_id=7, visit_id=3)

    for call in mock_client.chat.call_args_list:
        assert call.kwargs.get("patient_id") == 7
        assert call.kwargs.get("visit_id") == 3


@pytest.mark.asyncio
async def test_run_reuses_session_across_calls():
    """run() passes session_id from first response into subsequent calls."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("DDx output", session_id=55),
        _make_event("History output"),
        _make_event("SOAP output"),
    ]

    sim = DoctorSimulator(client=mock_client)
    await sim.run(patient_id=1)

    second_call = mock_client.chat.call_args_list[1].kwargs
    third_call = mock_client.chat.call_args_list[2].kwargs
    assert second_call.get("session_id") == 55
    assert third_call.get("session_id") == 55
