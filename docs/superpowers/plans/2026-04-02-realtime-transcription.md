# Real-Time Transcription Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Live" recording mode that shows real-time transcript preview via Web Speech API while capturing audio for Whisper post-processing.

**Architecture:** Extend ConversationRecorder with a `live-recording` state that runs MediaRecorder and SpeechRecognition in parallel. Add a live preview panel to ClinicalNotesEditor that shows streaming text. On stop, Whisper refines the transcript. Falls back to the live transcript if Whisper fails.

**Tech Stack:** Web Speech API (live preview), MediaRecorder (audio capture), existing Whisper endpoint (post-processing), React state management

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `web/components/doctor/conversation-recorder.tsx` | Add live-recording mode with dual MediaRecorder + SpeechRecognition |
| Create | `web/components/doctor/live-transcript-preview.tsx` | Preview panel showing streaming text |
| Modify | `web/components/doctor/clinical-notes-editor.tsx` | Wire up live preview panel between toolbar and textarea |

---

### Task 1: Add Live Recording Mode to ConversationRecorder

**Files:**
- Modify: `web/components/doctor/conversation-recorder.tsx:1-200`

- [ ] **Step 1: Update types and add new props**

In `web/components/doctor/conversation-recorder.tsx`, update the `RecorderState` type and props interface:

```typescript
type RecorderState = "idle" | "recording" | "live-recording" | "transcribing";

interface ConversationRecorderProps {
  visitId: number;
  disabled?: boolean;
  onTranscribed?: (text: string) => void;
  onLiveText?: (text: string) => void;
  onLiveStateChange?: (isLive: boolean, isRefining: boolean) => void;
}
```

Add `onLiveText` and `onLiveStateChange` to the component destructuring:

```typescript
export function ConversationRecorder({
  visitId,
  disabled = false,
  onTranscribed,
  onLiveText,
  onLiveStateChange,
}: ConversationRecorderProps) {
```

- [ ] **Step 2: Add recognition ref and startLiveRecording function**

Add a ref for the speech recognition instance after the existing refs:

```typescript
const recognitionRef = useRef<any>(null);
```

Update the cleanup effect to also stop recognition:

```typescript
useEffect(() => {
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  };
}, []);
```

Add the `startLiveRecording` function after `startRecording`:

```typescript
const startLiveRecording = useCallback(async () => {
  setError(null);
  const SpeechRecognitionAPI = getSpeechRecognition();
  if (!SpeechRecognitionAPI) {
    setError("Live transcription not supported in this browser");
    return;
  }

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

    // Will be called by stopRecording
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (audioBlob.size === 0) {
        setState("idle");
        onLiveStateChange?.(false, false);
        setError("No audio recorded");
        return;
      }

      // Refining phase — send to Whisper
      setState("transcribing");
      onLiveStateChange?.(false, true);
      try {
        const result = await transcribeAudio(visitId, audioBlob);
        onTranscribed?.(result.text);
      } catch {
        // Whisper failed — use the live transcript as fallback
        const fallbackText = liveTextRef.current;
        if (fallbackText) {
          const result = await saveTranscript(visitId, fallbackText);
          onTranscribed?.(result.text);
        } else {
          setError("Transcription failed");
        }
      }
      setState("idle");
      onLiveText?.("");
      onLiveStateChange?.(false, false);
    };

    // Start speech recognition
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const fullText = (finalTranscript + interim).trim();
      liveTextRef.current = fullText;
      onLiveText?.(fullText);
    };

    recognition.onerror = (e: any) => {
      // Don't stop recording on speech errors — audio capture continues
      if (e.error !== "no-speech") {
        setError(`Speech recognition: ${e.error}`);
      }
    };

    recognition.onend = () => {
      // Restart if still in live-recording state (browser may auto-stop)
      if (state === "live-recording" && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // Already stopped, ignore
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    setState("live-recording");
    onLiveStateChange?.(true, false);
  } catch (err: any) {
    setError(
      err.name === "NotAllowedError"
        ? "Microphone access denied"
        : "Could not start recording"
    );
  }
}, [visitId, onTranscribed, onLiveText, onLiveStateChange, state]);
```

- [ ] **Step 3: Add liveTextRef and update stopRecording**

Add a ref to track the current live text (for Whisper fallback), after the other refs:

```typescript
const liveTextRef = useRef<string>("");
```

Update `stopRecording` to also stop speech recognition:

```typescript
const stopRecording = useCallback(() => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
  if (recognitionRef.current) {
    recognitionRef.current.abort();
    recognitionRef.current = null;
  }
  if (mediaRecorderRef.current?.state === "recording") {
    mediaRecorderRef.current.stop();
  }
}, []);
```

- [ ] **Step 4: Update the JSX to add Live button and live-recording state**

Replace the return JSX:

```tsx
const hasLiveSupport = typeof window !== "undefined" && getSpeechRecognition() !== null;

return (
  <div className="flex items-center gap-2">
    {state === "idle" && (
      <>
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
        {hasLiveSupport && (
          <button
            type="button"
            onClick={startLiveRecording}
            disabled={disabled}
            title="Record with live transcript"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            <Radio className="w-3 h-3" />
            Live
          </button>
        )}
      </>
    )}

    {(state === "recording" || state === "live-recording") && (
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
```

- [ ] **Step 5: Add Radio import**

Update the lucide-react import at the top of the file:

```typescript
import { Mic, Square, Loader2, AlertCircle, Radio } from "lucide-react";
```

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/conversation-recorder.tsx
git commit -m "feat(transcription): add live recording mode with dual MediaRecorder + SpeechRecognition"
```

---

### Task 2: Create LiveTranscriptPreview Component

**Files:**
- Create: `web/components/doctor/live-transcript-preview.tsx`

- [ ] **Step 1: Create the preview panel component**

Create `web/components/doctor/live-transcript-preview.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";

interface LiveTranscriptPreviewProps {
  text: string;
  isRefining: boolean;
}

export function LiveTranscriptPreview({
  text,
  isRefining,
}: LiveTranscriptPreviewProps) {
  return (
    <div className="mx-3 mt-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {isRefining ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            Refining with AI...
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live transcript
          </span>
        )}
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
        {text || (
          <span className="text-muted-foreground italic">Listening...</span>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/doctor/live-transcript-preview.tsx
git commit -m "feat(transcription): add LiveTranscriptPreview panel component"
```

---

### Task 3: Wire Up Live Preview in ClinicalNotesEditor

**Files:**
- Modify: `web/components/doctor/clinical-notes-editor.tsx:1-107`

- [ ] **Step 1: Add imports and state**

Add import for the preview component at the top of `clinical-notes-editor.tsx`:

```typescript
import { ConversationRecorder } from "./conversation-recorder";
import { LiveTranscriptPreview } from "./live-transcript-preview";
```

(Remove the existing `import { ConversationRecorder }` line and replace with the above two imports.)

Add `useState` to the React import:

```typescript
import { useState } from "react";
import { FileEdit, Check, Loader2, Sparkles } from "lucide-react";
```

- [ ] **Step 2: Add live state and callbacks to the component**

Inside the `ClinicalNotesEditor` function, add state and callbacks before the existing `handleTranscribed`:

```typescript
const [liveText, setLiveText] = useState("");
const [isLive, setIsLive] = useState(false);
const [isRefining, setIsRefining] = useState(false);

const handleLiveText = (text: string) => {
  setLiveText(text);
};

const handleLiveStateChange = (live: boolean, refining: boolean) => {
  setIsLive(live);
  setIsRefining(refining);
  if (!live && !refining) {
    setLiveText("");
  }
};
```

- [ ] **Step 3: Pass new props to ConversationRecorder**

Update the `ConversationRecorder` usage in the toolbar:

```tsx
{visitId && (
  <ConversationRecorder
    visitId={visitId}
    disabled={disabled}
    onTranscribed={handleTranscribed}
    onLiveText={handleLiveText}
    onLiveStateChange={handleLiveStateChange}
  />
)}
```

- [ ] **Step 4: Add preview panel between toolbar and editor**

Add the preview panel after the toolbar div and before the editor div:

```tsx
{/* Toolbar */}
<div className="flex items-center justify-end gap-3 px-3 py-2 border-b border-border/50">
  {/* ... existing toolbar content ... */}
</div>

{/* Live transcript preview */}
{(isLive || isRefining) && (
  <LiveTranscriptPreview text={liveText} isRefining={isRefining} />
)}

{/* Editor */}
<div className="p-3 flex-1">
  {/* ... existing textarea ... */}
</div>
```

- [ ] **Step 5: Verify the app compiles**

Run: `cd /Users/kien.ha/Code/medical_agent/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add web/components/doctor/clinical-notes-editor.tsx
git commit -m "feat(transcription): wire up live preview panel in clinical notes editor"
```
