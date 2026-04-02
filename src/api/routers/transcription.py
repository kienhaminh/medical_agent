"""Transcription endpoints — audio-to-text via Whisper with browser fallback."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Transcription"])


class TranscriptRequest(BaseModel):
    """Request body for browser-native transcription fallback."""
    text: str


class TranscriptResponse(BaseModel):
    """Response from transcription endpoints."""
    text: str
    source: str  # "whisper" or "browser"


def _append_to_clinical_notes(visit: Visit, text: str) -> str:
    """Append timestamped transcript to clinical notes."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    entry = f"[{timestamp}] Recording transcript:\n{text}"
    if visit.clinical_notes:
        visit.clinical_notes = f"{visit.clinical_notes}\n\n{entry}"
    else:
        visit.clinical_notes = entry
    return text


@router.post("/api/visits/{visit_id}/transcribe", response_model=TranscriptResponse)
async def transcribe_audio(
    visit_id: int,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Transcribe uploaded audio via OpenAI Whisper API and append to clinical notes."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    try:
        client = OpenAI()
        whisper_response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(audio.filename or "recording.webm", await audio.read(), audio.content_type or "audio/webm"),
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
