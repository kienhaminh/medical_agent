# Doctor-Patient Conversation Recorder

## Overview

A lightweight speech-to-text feature for recording doctor-patient conversations during live consultations. Audio is captured in-browser, transcribed via OpenAI Whisper API, and appended to the visit's clinical notes. Browser-native Web Speech API serves as fallback.

## Requirements

- Record audio during live doctor-patient consultations
- Transcribe via OpenAI Whisper API (primary)
- Fall back to browser-native Web Speech API if Whisper is unavailable
- Record-then-transcribe flow (not real-time streaming)
- Append transcribed text to Visit clinical notes
- Single transcript — no speaker diarization

## Architecture

```
Browser (MediaRecorder API)
  → Record audio blob (webm/opus)
  → POST /api/visits/{visit_id}/transcribe (multipart/form-data)
  → FastAPI receives audio
  → OpenAI Whisper API → text
  → Append to Visit.clinical_notes
  → Return transcription to frontend

Fallback path:
  → Browser Web Speech API → text (entirely client-side)
  → POST /api/visits/{visit_id}/transcript (JSON)
  → Append to Visit.clinical_notes
```

## Frontend

### ConversationRecorder Component

Location: `web/components/doctor/conversation-recorder.tsx`

Responsibilities:
- Record/Stop toggle button with recording duration indicator
- Uses `MediaRecorder` API to capture audio as webm/opus format
- On stop: sends audio blob to backend via `POST /api/visits/{visit_id}/transcribe`
- Displays returned transcript for review before confirming
- Each recording appends to the visit's running transcript

### Fallback Behavior

- If backend transcription endpoint returns an error, frontend activates Web Speech API
- Uses `webkitSpeechRecognition` / `SpeechRecognition` browser API
- Transcription happens entirely in-browser
- Result is POSTed as plain text to `POST /api/visits/{visit_id}/transcript`
- UI indicates when fallback mode is active

### Integration Point

- Component placed on the doctor's visit/consultation page
- Requires `visitId` prop to associate recordings with the correct visit

## Backend

### New Endpoint: Transcribe Audio

```
POST /api/visits/{visit_id}/transcribe
Content-Type: multipart/form-data
Body: audio file (webm/opus)

Response: {
  "text": "transcribed text...",
  "source": "whisper"
}
```

Flow:
1. Receive audio file from frontend
2. Call OpenAI Whisper API (`audio/transcriptions` endpoint, model: `whisper-1`)
3. Append transcribed text to `Visit.clinical_notes` with timestamp
4. Return transcription text

### New Endpoint: Save Transcript (Fallback)

```
POST /api/visits/{visit_id}/transcript
Content-Type: application/json
Body: { "text": "transcribed text..." }

Response: {
  "text": "transcribed text...",
  "source": "browser"
}
```

Flow:
1. Receive text from browser-native transcription
2. Append to `Visit.clinical_notes` with timestamp
3. Return confirmation

### Router Organization

New file: `src/api/routers/transcription.py`

Registered in the visits router or as a standalone router mounted at `/api/visits`.

### Transcript Format in Clinical Notes

Each transcription appends to `Visit.clinical_notes` with a timestamped block:

```
[2026-04-02 14:30:15] Recording transcript:
Patient presents with persistent cough for 3 days...
```

Multiple recordings during a visit append sequentially.

## Data Model

No new database tables or migrations required. Uses the existing `Visit.clinical_notes` text field.

## Fallback Strategy

Priority order:
1. OpenAI Whisper API (primary) — best accuracy, handles medical terminology well
2. If Whisper API call fails → return error to frontend
3. Frontend catches error → activates Web Speech API in-browser
4. Browser transcription completes → POSTs text to `/transcript` endpoint

## Dependencies

### Backend
- `openai` Python SDK (already installed) — for Whisper API calls
- `python-multipart` — for file upload handling (verify installed)

### Frontend
- No new packages — `MediaRecorder` and `SpeechRecognition` are browser-native APIs

## Error Handling

- Audio recording permission denied → show user-friendly message
- Whisper API timeout/failure → automatic fallback to Web Speech API
- Web Speech API unavailable (non-Chrome) → show "text input only" message
- Visit not found → 404 response
- Empty audio → validation error before API call

## Security

- Audio files are not persisted — transcribed and discarded
- Audio sent over HTTPS to OpenAI API
- No PII stored beyond what's already in clinical notes
- Follows existing CORS configuration
