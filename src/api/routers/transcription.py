"""Transcription endpoints — audio-to-text via Whisper with browser fallback."""
import logging
from datetime import datetime, timezone

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from openai import OpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Transcription"])

# Module-level OpenAI client — reused across requests
_openai_client = OpenAI()

# Max audio upload size: 25MB (Whisper API limit)
_MAX_AUDIO_BYTES = 25 * 1024 * 1024
_ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"}


class TranscriptRequest(BaseModel):
    """Request body for browser-native transcription fallback."""
    text: str = Field(..., min_length=1)


class TranscriptResponse(BaseModel):
    """Response from transcription endpoints."""
    text: str
    source: Literal["whisper", "browser"]


def _append_to_clinical_notes(visit: Visit, text: str) -> None:
    """Append timestamped transcript to clinical notes."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    entry = f"[{timestamp}] Recording transcript:\n{text}"
    if visit.clinical_notes:
        visit.clinical_notes = f"{visit.clinical_notes}\n\n{entry}"
    else:
        visit.clinical_notes = entry


@router.post("/api/visits/{visit_id}/transcribe", response_model=TranscriptResponse)
async def transcribe_audio(
    visit_id: int,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Transcribe uploaded audio via OpenAI Whisper API and append to clinical notes."""
    # Validate content type
    content_type = audio.content_type or ""
    if content_type not in _ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=422, detail=f"Unsupported audio type: {content_type}")

    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    audio_data = await audio.read()
    if len(audio_data) > _MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    try:
        whisper_response = _openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio.filename or "recording.webm", audio_data, content_type),
        )
        text = whisper_response.text
    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        raise HTTPException(status_code=502, detail="Transcription service unavailable")

    _append_to_clinical_notes(visit, text)
    await db.commit()
    await db.refresh(visit)

    return TranscriptResponse(text=text, source="whisper")


@router.post("/api/visits/{visit_id}/transcript", response_model=TranscriptResponse)
async def save_transcript(
    visit_id: int,
    body: TranscriptRequest,
    db: AsyncSession = Depends(get_db),
):
    """Save browser-transcribed text to clinical notes (fallback endpoint)."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    _append_to_clinical_notes(visit, body.text)
    await db.commit()
    await db.refresh(visit)

    return TranscriptResponse(text=body.text, source="browser")
