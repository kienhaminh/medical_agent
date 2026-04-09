"use client";

import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import {
  Send,
  RotateCcw,
  Mic,
  Radio,
  Square,
  Loader2,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";
import { LiveTranscriptPreview } from "./live-transcript-preview";

export interface ChatInputAreaHandle {
  inject: (text: string) => void;
}

interface ChatInputAreaProps {
  hasMessages: boolean;
  isLoading: boolean;
  onSubmit: (message: string) => void;
  onStop?: () => void;
  onReset?: () => void;
  visitId?: number;
  onTranscribed?: (text: string) => void;
  // Signal from parent to clear input (e.g. on chat reset)
  resetKey?: number;
}

export const ChatInputArea = forwardRef<ChatInputAreaHandle, ChatInputAreaProps>(function ChatInputArea({
  hasMessages,
  isLoading,
  onSubmit,
  onStop,
  onReset,
  visitId,
  onTranscribed,
  resetKey,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [recorderState, setRecorderState] = useState<
    "idle" | "recording" | "live-recording" | "transcribing"
  >("idle");
  const [recorderDuration, setRecorderDuration] = useState(0);
  const [recorderError, setRecorderError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    inject: (text: string) => {
      setInput(text);
      textareaRef.current?.focus();
      setTimeout(autoResize, 0);
    },
  }));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTextRef = useRef("");

  // Clear input when parent signals a reset
  useEffect(() => {
    setInput("");
    autoResize("");
  }, [resetKey]);

  const autoResize = (value?: string) => {
    const el = textareaRef.current;
    if (!el) return;
    if (value === "") {
      el.style.height = "28px";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    if (input === "") autoResize("");
  }, [input]);

  const getSpeechRecognition = () =>
    typeof window === "undefined"
      ? null
      : (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null;

  const hasLiveSupport =
    typeof window !== "undefined" && getSpeechRecognition() !== null;

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording")
      mediaRecorderRef.current.stop();
  };

  const startRecording = async () => {
    setRecorderError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setRecorderState("idle");
          setRecorderError("No audio recorded");
          return;
        }
        setRecorderState("transcribing");
        try {
          const { transcribeAudio } = await import("@/lib/api-transcription");
          const result = await transcribeAudio(visitId!, blob);
          onTranscribed?.(result.text);
        } catch {
          setRecorderError("Transcription failed");
        }
        setRecorderState("idle");
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecorderDuration(0);
      timerRef.current = setInterval(
        () => setRecorderDuration((d) => d + 1),
        1000,
      );
      setRecorderState("recording");
    } catch (err: any) {
      setRecorderError(
        err.name === "NotAllowedError" ? "Mic denied" : "Could not start",
      );
    }
  };

  const startLiveRecording = async () => {
    setRecorderError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setRecorderError("Live not supported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setRecorderState("idle");
          setIsLive(false);
          setIsRefining(false);
          return;
        }
        setRecorderState("transcribing");
        setIsLive(false);
        setIsRefining(true);
        try {
          const { transcribeAudio } = await import("@/lib/api-transcription");
          const result = await transcribeAudio(visitId!, blob);
          onTranscribed?.(result.text);
        } catch {
          const fallback = liveTextRef.current;
          if (fallback) {
            const { saveTranscript } = await import("@/lib/api-transcription");
            const result = await saveTranscript(visitId!, fallback);
            onTranscribed?.(result.text);
          } else {
            setRecorderError("Transcription failed");
          }
        }
        setRecorderState("idle");
        setLiveText("");
        setIsLive(false);
        setIsRefining(false);
      };
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      let finalTranscript = "";
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal)
            finalTranscript += event.results[i][0].transcript + " ";
          else interim += event.results[i][0].transcript;
        }
        const full = (finalTranscript + interim).trim();
        liveTextRef.current = full;
        setLiveText(full);
      };
      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech") setRecorderError(`SR: ${e.error}`);
      };
      recognition.onend = () => {
        if (recognitionRef.current)
          try {
            recognition.start();
          } catch {}
      };
      recognitionRef.current = recognition;
      recognition.start();
      mediaRecorderRef.current = mr;
      mr.start();
      setRecorderDuration(0);
      timerRef.current = setInterval(
        () => setRecorderDuration((d) => d + 1),
        1000,
      );
      setRecorderState("live-recording");
      setIsLive(true);
    } catch (err: any) {
      setRecorderError(
        err.name === "NotAllowedError" ? "Mic denied" : "Could not start",
      );
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const submitMessage = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  }, [input, isLoading, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  return (
    <>
      {/* Live transcript preview */}
      {(isLive || isRefining) && (
        <LiveTranscriptPreview text={liveText} isRefining={isRefining} />
      )}

      {/* Status row — errors / transcribing */}
      {(recorderError || recorderState === "transcribing") && (
        <div className="flex items-center gap-1.5 px-3 py-1 border-t border-border/20 text-[10px]">
          {recorderState === "transcribing" && (
            <span className="flex items-center gap-1 text-muted-foreground/50">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transcribing...
            </span>
          )}
          {recorderError && (
            <span className="flex items-center gap-1 text-red-400/80">
              <AlertCircle className="w-3 h-3" />
              {recorderError}
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border/40 px-3 pb-3 pt-2 space-y-2">
        <form onSubmit={(e) => { e.preventDefault(); submitMessage(); }}>
          <div
            className={cn(
              "flex flex-col rounded-xl border bg-card/60 transition-all duration-200",
              "border-border/40 focus-within:border-primary/40",
              "focus-within:ring-2 focus-within:ring-primary/8",
              "focus-within:shadow-[0_0_20px_hsl(var(--primary)/0.05)]",
            )}
          >
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize(e.target.value);
                if (e.target.value.trim()) setMediaExpanded(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about diagnosis, treatment, or patient history..."
              disabled={isLoading}
              rows={2}
              className="w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm text-foreground
                         placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-40
                         leading-relaxed overflow-hidden min-h-14 max-h-[180px]"
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between px-2 pb-2">
              {/* Left: media / recording */}
              <div className="flex items-center gap-0.5">
                {(recorderState === "recording" ||
                  recorderState === "live-recording") && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    title="Stop recording"
                    className="flex items-center gap-1 px-2 h-6 rounded-full bg-red-500/12 text-red-400 text-[10px] font-mono animate-pulse border border-red-500/20"
                  >
                    <Square className="w-2 h-2 fill-red-400" />
                    {formatDuration(recorderDuration)}
                  </button>
                )}

                {visitId && recorderState === "idle" && (
                  <>
                    {!mediaExpanded ? (
                      <button
                        type="button"
                        onClick={() => setMediaExpanded(true)}
                        disabled={isLoading}
                        title="Recording tools"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/35 hover:text-foreground/60 hover:bg-muted/50 transition-all duration-150 disabled:opacity-20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-0.5 animate-in slide-in-from-left-1 duration-150">
                        <button
                          type="button"
                          onClick={startRecording}
                          disabled={isLoading}
                          title="Record audio"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20"
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </button>
                        {hasLiveSupport && (
                          <button
                            type="button"
                            onClick={startLiveRecording}
                            disabled={isLoading}
                            title="Live transcription"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-20"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMediaExpanded(false)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/25 hover:text-muted-foreground/60 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right: reset + send/stop */}
              <div className="flex items-center gap-1">
                {hasMessages && onReset && recorderState === "idle" && (
                  <button
                    type="button"
                    onClick={onReset}
                    title="Reset chat"
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/40 transition-all duration-150"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}

                {isLoading ? (
                  <button
                    type="button"
                    onClick={onStop}
                    title="Stop"
                    className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-destructive/85 hover:bg-destructive transition-colors text-white text-[11px] font-medium shadow-[0_1px_6px_hsl(var(--destructive)/0.3)]"
                  >
                    <Square className="w-2.5 h-2.5 fill-white" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150",
                      input.trim()
                        ? "bg-primary text-white shadow-[0_1px_8px_hsl(var(--primary)/0.35)] hover:opacity-90"
                        : "bg-muted/50 text-muted-foreground/30 cursor-not-allowed",
                    )}
                  >
                    <Send className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

      </div>
    </>
  );
});
