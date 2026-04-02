"""Tests for transcription endpoints."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport

from src.api.server import app


@pytest.fixture
def mock_db_visit():
    """Create a mock visit object."""
    visit = MagicMock()
    visit.id = 1
    visit.clinical_notes = None
    return visit


@pytest.mark.asyncio
async def test_transcribe_audio_returns_text(mock_db_visit):
    """POST /api/visits/{id}/transcribe returns transcribed text."""
    mock_whisper_response = MagicMock()
    mock_whisper_response.text = "Patient reports chest pain for two days."

    with (
        patch("src.api.routers.transcription.get_db") as mock_get_db,
        patch("src.api.routers.transcription._openai_client") as mock_client,
    ):
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_db_visit

        async def mock_execute(*args, **kwargs):
            return mock_result

        mock_session.execute = mock_execute
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        mock_get_db.return_value = mock_session
        mock_client.audio.transcriptions.create.return_value = mock_whisper_response

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/visits/1/transcribe",
                files={"audio": ("recording.webm", b"fake-audio-data", "audio/webm")},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Patient reports chest pain for two days."
    assert data["source"] == "whisper"


@pytest.mark.asyncio
async def test_transcribe_audio_visit_not_found():
    """POST /api/visits/{id}/transcribe returns 404 for missing visit."""
    with patch("src.api.routers.transcription.get_db") as mock_get_db:
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None

        async def mock_execute(*args, **kwargs):
            return mock_result

        mock_session.execute = mock_execute

        mock_get_db.return_value = mock_session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/visits/999/transcribe",
                files={"audio": ("recording.webm", b"fake-audio-data", "audio/webm")},
            )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_save_transcript_text(mock_db_visit):
    """POST /api/visits/{id}/transcript saves browser-transcribed text."""
    with patch("src.api.routers.transcription.get_db") as mock_get_db:
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_db_visit

        async def mock_execute(*args, **kwargs):
            return mock_result

        mock_session.execute = mock_execute
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        mock_get_db.return_value = mock_session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post(
                "/api/visits/1/transcript",
                json={"text": "Patient has a mild cough."},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Patient has a mild cough."
    assert data["source"] == "browser"
