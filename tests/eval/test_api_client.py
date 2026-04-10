# tests/eval/test_api_client.py
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from eval.api_client import EvalApiClient, ChatEvent


@pytest.mark.asyncio
async def test_chat_parses_sse_chunks():
    """chat() collects chunk text and tool_calls from SSE stream."""
    sse_events = [
        {"chunk": "Hello "},
        {"chunk": "patient."},
        {"tool_call": {"name": "complete_triage", "args": {"department": "Cardiology", "confidence": 0.85}}},
        {"session_id": 42},
        {"done": True},
    ]

    async def mock_aiter_lines():
        for event in sse_events:
            yield f"data: {json.dumps(event)}"
            yield ""

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = MagicMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "stream", return_value=mock_stream_ctx):
            event = await client.chat(message="I have chest pain", patient_id=1)

    assert event.content == "Hello patient."
    assert len(event.tool_calls) == 1
    assert event.tool_calls[0]["name"] == "complete_triage"
    assert event.tool_calls[0]["args"]["department"] == "Cardiology"
    assert event.session_id == 42


@pytest.mark.asyncio
async def test_create_patient_posts_correct_payload():
    """create_patient() POSTs to /api/patients and returns parsed JSON."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"id": 7, "name": "John Doe", "dob": "1970-01-01", "gender": "male", "created_at": "2026-04-10T00:00:00"}

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "post", return_value=mock_response) as mock_post:
            result = await client.create_patient("John Doe", "1970-01-01", "male")

    mock_post.assert_called_once_with(
        "/api/patients",
        json={"name": "John Doe", "dob": "1970-01-01", "gender": "male"},
    )
    assert result["id"] == 7


@pytest.mark.asyncio
async def test_form_response_posts_to_correct_url():
    """form_response() POSTs to /api/chat/{session_id}/form-response."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "post", return_value=mock_response) as mock_post:
            await client.form_response(
                session_id=42,
                form_id="form-abc",
                answers={"chief_complaint": "chest pain"},
                template="patient_intake",
            )

    mock_post.assert_called_once_with(
        "/api/chat/42/form-response",
        json={"form_id": "form-abc", "answers": {"chief_complaint": "chest pain"}, "template": "patient_intake"},
    )


@pytest.mark.asyncio
async def test_chat_ignores_non_data_lines():
    """chat() skips blank lines and comment lines in SSE stream."""
    async def mock_aiter_lines():
        yield ": keep-alive"
        yield ""
        yield 'data: {"chunk": "hello"}'
        yield ""
        yield 'data: {"done": true}'

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = MagicMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "stream", return_value=mock_stream_ctx):
            event = await client.chat(message="hi", patient_id=1)

    assert event.content == "hello"
