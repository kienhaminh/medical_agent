# Conversation Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a record button to the doctor's clinical workspace that captures audio, transcribes it via OpenAI Whisper API, and appends the text to the visit's clinical notes. Falls back to browser-native Web Speech API when Whisper is unavailable.

**Architecture:** Two new backend endpoints on the visits router — one accepts audio files for Whisper transcription, one accepts plain text from the browser fallback. A new React component `ConversationRecorder` uses `MediaRecorder` for audio capture and `SpeechRecognition` as fallback. Integrates into the existing `ClinicalNotesEditor` toolbar.

**Tech Stack:** FastAPI + OpenAI Whisper API (backend), MediaRecorder + Web Speech API (frontend), existing SQLAlchemy Visit model

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/api/routers/transcription.py` | Two endpoints: audio transcribe + text transcript |
| Modify | `src/api/server.py:22,128` | Register transcription router |
| Create | `web/components/doctor/conversation-recorder.tsx` | Audio recording UI + fallback logic |
| Modify | `web/components/doctor/clinical-notes-editor.tsx` | Add recorder to toolbar |
| Create | `web/lib/api-transcription.ts` | API client functions for transcription endpoints |
| Create | `tests/unit/test_transcription_router.py` | Backend endpoint tests |

---

### Task 1: Backend Transcription Endpoints

**Files:**
- Create: `src/api/routers/transcription.py`
- Modify: `src/api/server.py:22,128`
- Test: `tests/unit/test_transcription_router.py`

- [ ] **Step 1: Write failing test for audio transcribe endpoint**

Create `tests/unit/test_transcription_router.py`:

```python
"""Tests for transcription endpoints."""
import pytest
from unittest.mock import patch, MagicMock
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
        patch("src.api.routers.transcription.OpenAI") as mock_openai_cls,
    ):
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_db_visit

        async def mock_execute(*args, **kwargs):
            return mock_result

        mock_session.execute = mock_execute
        mock_session.commit = MagicMock(return_value=None)
        mock_session.refresh = MagicMock(return_value=None)

        # Make commit and refresh async
        from unittest.mock import AsyncMock
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_session

        mock_client = MagicMock()
        mock_client.audio.transcriptions.create.return_value = mock_whisper_response
        mock_openai_cls.return_value = mock_client

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

        from unittest.mock import AsyncMock
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/unit/test_transcription_router.py -v`
Expected: FAIL — `src.api.routers.transcription` does not exist

- [ ] **Step 3: Create transcription router**

Create `src/api/routers/transcription.py`:

```python
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
```

- [ ] **Step 4: Register the router in server.py**

In `src/api/server.py`, add the import at line 22:

```python
from .routers import patients, agents, tools, chat, usage, skills, visits, departments, hospital, auth, orders, ws, case_threads, transcription
```

Add the router inclusion after line 129:

```python
app.include_router(transcription.router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/unit/test_transcription_router.py -v`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/routers/transcription.py src/api/server.py tests/unit/test_transcription_router.py
git commit -m "feat(transcription): add Whisper transcribe + browser fallback endpoints"
```

---

### Task 2: Frontend API Client Functions

**Files:**
- Create: `web/lib/api-transcription.ts`

- [ ] **Step 1: Create API client for transcription endpoints**

Create `web/lib/api-transcription.ts`:

```typescript
const API_BASE_URL = "http://localhost:8000/api";

export interface TranscriptResponse {
  text: string;
  source: "whisper" | "browser";
}

/**
 * Send recorded audio to the backend for Whisper transcription.
 * Returns the transcribed text.
 */
export async function transcribeAudio(
  visitId: number,
  audioBlob: Blob
): Promise<TranscriptResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch(
    `${API_BASE_URL}/visits/${visitId}/transcribe`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Transcription failed");
  }

  return response.json();
}

/**
 * Send browser-transcribed text to the backend (fallback path).
 */
export async function saveTranscript(
  visitId: number,
  text: string
): Promise<TranscriptResponse> {
  const response = await fetch(
    `${API_BASE_URL}/visits/${visitId}/transcript`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save transcript");
  }

  return response.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/api-transcription.ts
git commit -m "feat(transcription): add frontend API client for transcription endpoints"
```

---

### Task 3: ConversationRecorder Component

**Files:**
- Create: `web/components/doctor/conversation-recorder.tsx`

- [ ] **Step 1: Create the ConversationRecorder component**

Create `web/components/doctor/conversation-recorder.tsx`:

```tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { transcribeAudio, saveTranscript } from "@/lib/api-transcription";

interface ConversationRecorderProps {
  visitId: number;
  disabled?: boolean;
  onTranscribed?: (text: string) => void;
}

type RecorderState = "idle" | "recording" | "transcribing";

/**
 * Check if browser-native speech recognition is available.
 */
function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function ConversationRecorder({
  visitId,
  disabled = false,
  onTranscribed,
}: ConversationRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          setState("idle");
          setError("No audio recorded");
          return;
        }

        setState("transcribing");
        try {
          const result = await transcribeAudio(visitId, audioBlob);
          onTranscribed?.(result.text);
        } catch {
          // Whisper failed — try browser-native fallback
          await fallbackTranscribe(audioBlob);
        }
        setState("idle");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      setState("recording");
    } catch (err: any) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone access denied"
          : "Could not start recording"
      );
    }
  }, [visitId, onTranscribed]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const fallbackTranscribe = useCallback(
    async (_audioBlob: Blob) => {
      const SpeechRecognitionAPI = getSpeechRecognition();
      if (!SpeechRecognitionAPI) {
        setError("Transcription unavailable — no fallback supported");
        return;
      }

      setError(null);
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        const text = await new Promise<string>((resolve, reject) => {
          let transcript = "";
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript + " ";
              }
            }
          };
          recognition.onend = () => resolve(transcript.trim());
          recognition.onerror = (e: any) => reject(new Error(e.error));
          recognition.start();

          // Web Speech API can't replay a blob — it listens to the mic live.
          // Since the recording already stopped, we restart a short listening session.
          // For the fallback, the user will need to repeat or we save what we got.
          setTimeout(() => recognition.stop(), 30000);
        });

        if (text) {
          const result = await saveTranscript(visitId, text);
          onTranscribed?.(result.text);
        } else {
          setError("No speech detected in fallback mode");
        }
      } catch {
        setError("Browser speech recognition failed");
      }
    },
    [visitId, onTranscribed]
  );

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      {state === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled}
          title="Record conversation"
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <Mic className="w-3 h-3" />
          Record
        </button>
      )}

      {state === "recording" && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-red-600 text-white border border-red-700 hover:bg-red-700 transition-colors animate-pulse"
        >
          <Square className="w-3 h-3" />
          {formatDuration(duration)}
        </button>
      )}

      {state === "transcribing" && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Transcribing...
        </span>
      )}

      {error && (
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/doctor/conversation-recorder.tsx
git commit -m "feat(transcription): add ConversationRecorder component with Whisper + browser fallback"
```

---

### Task 4: Integrate Recorder into Clinical Notes Editor

**Files:**
- Modify: `web/components/doctor/clinical-notes-editor.tsx:1-90`

- [ ] **Step 1: Add ConversationRecorder to the ClinicalNotesEditor toolbar**

In `web/components/doctor/clinical-notes-editor.tsx`:

Add the import at the top:

```typescript
import { ConversationRecorder } from "./conversation-recorder";
```

Update the `ClinicalNotesEditorProps` interface to add:

```typescript
interface ClinicalNotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
  onDraftWithAI?: () => void;
  drafting?: boolean;
  visitId?: number;  // NEW — needed for transcription
}
```

Update the component destructuring to include `visitId`:

```typescript
export function ClinicalNotesEditor({
  notes,
  onChange,
  saving,
  saved,
  disabled = false,
  onDraftWithAI,
  drafting = false,
  visitId,
}: ClinicalNotesEditorProps) {
```

Add the `handleTranscribed` callback and the `ConversationRecorder` inside the toolbar div, before the "Draft with AI" button:

```tsx
  const handleTranscribed = (text: string) => {
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp}] Recording transcript:\n${text}`;
    onChange(notes ? `${notes}\n\n${entry}` : entry);
  };

  return (
    <div className="overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3 px-3 py-2 border-b border-border/50">
        {visitId && (
          <ConversationRecorder
            visitId={visitId}
            disabled={disabled}
            onTranscribed={handleTranscribed}
          />
        )}
        {onDraftWithAI && (
          /* ... existing Draft with AI button stays the same ... */
        )}
        <SaveStatusIndicator saving={saving} saved={saved} />
      </div>
      {/* ... rest stays the same ... */}
```

- [ ] **Step 2: Pass visitId through ClinicalWorkspace**

In `web/components/doctor/clinical-workspace.tsx`:

Add `visitId` to `ClinicalWorkspaceProps`:

```typescript
interface ClinicalWorkspaceProps {
  // Patient
  patient: PatientDetail | null;
  selectedVisit: VisitListItem | null;

  // ... existing props ...
}
```

No new prop needed — `selectedVisit` already contains the visit id. Update the `ClinicalNotesEditor` usage to pass `visitId`:

```tsx
<ClinicalNotesEditor
  notes={props.clinicalNotes}
  onChange={props.onNotesChange}
  saving={props.notesSaving}
  saved={props.notesSaved}
  disabled={!hasPatient}
  onDraftWithAI={props.onDraftWithAI}
  drafting={props.draftingNote}
  visitId={props.selectedVisit?.id}
/>
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds without errors

- [ ] **Step 4: Commit**

```bash
git add web/components/doctor/clinical-notes-editor.tsx web/components/doctor/clinical-workspace.tsx
git commit -m "feat(transcription): integrate recorder into clinical notes toolbar"
```

---

### Task 5: Manual Integration Test

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd /Users/kien.ha/Code/medical_agent && python -m src.api.server

# Terminal 2
cd /Users/kien.ha/Code/medical_agent/web && npm run dev
```

- [ ] **Step 2: Verify endpoints exist**

```bash
curl -s http://localhost:8000/docs | grep -o "transcrib[e]*"
```

Expected: Shows the transcribe/transcript endpoints in the OpenAPI docs.

- [ ] **Step 3: Verify the Record button appears**

Navigate to a doctor consultation page with an active visit. The "Record" button should appear in the Clinical Notes toolbar next to "Draft with AI".

- [ ] **Step 4: Test the full flow**

1. Click "Record" — microphone permission prompt appears
2. Speak for a few seconds
3. Click the stop button (shows duration counter)
4. "Transcribing..." indicator appears
5. Text appears in the clinical notes editor with timestamp
6. Save the notes — verify they persist

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -u
git commit -m "fix(transcription): integration test fixes"
```
