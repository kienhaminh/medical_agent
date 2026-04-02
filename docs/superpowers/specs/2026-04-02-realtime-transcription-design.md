# Real-Time Transcription Mode

## Overview

Add a "Live" mode to the existing ConversationRecorder component. Web Speech API streams text in real-time into a preview panel below the clinical notes toolbar. MediaRecorder captures audio in parallel. When recording stops, the full audio is sent to Whisper for an accurate final transcript that replaces the live preview and appends to clinical notes.

## Requirements

- Live transcription preview using browser-native Web Speech API
- Parallel audio capture via MediaRecorder for Whisper post-processing
- Preview panel appears below toolbar during live recording
- Final Whisper transcript replaces preview text
- "Live" button hidden when Web Speech API is unavailable
- Existing "Record" (non-live) mode unchanged
- No backend changes — reuses existing transcribe endpoint

## Architecture

```
Doctor clicks "Live":
  → MediaRecorder starts (audio capture)
  → SpeechRecognition starts (live text stream)
  → Preview panel appears below toolbar
  → Live text updates as doctor speaks
  → Doctor clicks Stop
  → SpeechRecognition stops
  → Preview shows "Refining with AI..."
  → Audio blob → POST /api/visits/{id}/transcribe (existing endpoint)
  → Whisper returns accurate text
  → Preview replaced with final text
  → Final text appends to clinical notes via onTranscribed callback
  → Preview panel auto-dismisses
```

## Frontend Changes

### ConversationRecorder (`conversation-recorder.tsx`)

New state additions:
- `RecorderState` gains `"live-recording"` value
- New state: `liveText: string` — accumulated interim transcript from Web Speech API

New behavior for live mode:
- Start both `MediaRecorder` and `SpeechRecognition` simultaneously
- `SpeechRecognition.continuous = true`, `interimResults = true`
- Feed interim results to `liveText` state and `onLiveText` callback
- On stop: send audio blob to Whisper (reuses `transcribeAudio()`)
- On Whisper response: call `onTranscribed()` with final text, clear `liveText`

New prop:
- `onLiveText?: (text: string) => void` — streams interim text to parent for preview display

UI changes:
- New "Live" button alongside existing "Record" button
- "Live" button only rendered when `getSpeechRecognition()` returns non-null
- During live-recording: show stop button with duration (same as recording state)

### ClinicalNotesEditor (`clinical-notes-editor.tsx`)

New preview panel between toolbar and textarea:
- Renders when `liveText` is non-empty or transcription is in progress
- Shows live streaming text with a pulsing dot indicator
- Shows "Refining with AI..." during Whisper post-processing
- Auto-dismisses after final transcript delivered

State additions:
- `liveText: string` — fed from ConversationRecorder's onLiveText callback
- `isRefining: boolean` — true while waiting for Whisper after live recording stops

Preview panel styling:
- Light background (bg-amber-50/50), border, rounded
- Monospace or small text for transcript
- Pulsing red dot during live recording
- Spinner during "Refining with AI..." phase

### ClinicalWorkspace (`clinical-workspace.tsx`)

No changes — `visitId` is already passed through.

## Backend Changes

None. Reuses `POST /api/visits/{visit_id}/transcribe` endpoint.

## Fallback Behavior

- Web Speech API unavailable (non-Chrome browsers): "Live" button not rendered
- Only existing "Record" button shows (record-then-transcribe via Whisper)
- No degraded live mode — it's all-or-nothing since live preview IS the Web Speech API

## Error Handling

- SpeechRecognition error mid-recording: show error in preview panel, continue MediaRecorder capture so Whisper can still process the audio
- Whisper failure after live recording: fall back to using the Web Speech API transcript as the final text (it's already captured in liveText)
- Microphone permission denied: same as existing behavior
