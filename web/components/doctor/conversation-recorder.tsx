"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Loader2, AlertCircle, Radio } from "lucide-react";
import { transcribeAudio, saveTranscript } from "@/lib/api-transcription";

interface ConversationRecorderProps {
  visitId: number;
  disabled?: boolean;
  onTranscribed?: (text: string) => void;
  onLiveText?: (text: string) => void;
  onLiveStateChange?: (isLive: boolean, isRefining: boolean) => void;
}

type RecorderState = "idle" | "recording" | "live-recording" | "transcribing";

function getSpeechRecognition(): any | null {
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
  onLiveText,
  onLiveStateChange,
}: ConversationRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTextRef = useRef<string>("");

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

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          setState("idle");
          onLiveStateChange?.(false, false);
          setError("No audio recorded");
          return;
        }

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
        if (e.error !== "no-speech") {
          setError(`Speech recognition: ${e.error}`);
        }
      };

      recognition.onend = () => {
        // Restart if still in live-recording state (browser may auto-stop)
        if (recognitionRef.current) {
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
  }, [visitId, onTranscribed, onLiveText, onLiveStateChange]);

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
          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript + " ";
              }
            }
          };
          recognition.onend = () => resolve(transcript.trim());
          recognition.onerror = (e: any) => reject(new Error(e.error));
          recognition.start();

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
}
