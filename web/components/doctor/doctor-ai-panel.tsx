"use client";

import React, { RefObject, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, GripVertical, Zap, FileText, Stethoscope, Pill } from "lucide-react";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import type { AgentActivity, Message } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import "highlight.js/styles/github-dark.css";

interface DoctorAiPanelProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  patientName?: string;
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
}

const QUICK_PROMPTS = [
  { icon: FileText,     label: "Summarize",    text: "Summarize this patient's medical history and current condition." },
  { icon: Stethoscope,  label: "Differential", text: "What are the top differential diagnoses based on the current presentation?" },
  { icon: Zap,          label: "Treatment",    text: "Suggest a treatment plan based on the patient's records." },
  { icon: Pill,         label: "Drug check",   text: "Check for potential drug interactions in the current medication list." },
];

/** Animated ECG/heartbeat SVG for empty state */
function EcgLine() {
  return (
    <svg
      viewBox="0 0 320 60"
      className="w-full max-w-[260px] h-[60px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        @keyframes ecg-draw {
          0%   { stroke-dashoffset: 700; opacity: 0.2; }
          40%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes ecg-loop {
          0%   { stroke-dashoffset: 700; }
          60%  { stroke-dashoffset: 0; }
          80%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -700; opacity: 0; }
        }
        .ecg-path {
          stroke-dasharray: 700;
          stroke-dashoffset: 700;
          animation: ecg-loop 3s ease-in-out infinite;
        }
      `}</style>
      <path
        className="ecg-path"
        d="M0 30 L40 30 L55 30 L65 8 L72 52 L80 30 L95 30 L105 30 L112 18 L118 42 L124 30 L160 30 L170 30 L178 12 L185 48 L192 30 L210 30 L220 30 L228 20 L234 40 L240 30 L280 30 L320 30"
        stroke="url(#ecgGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
          <stop offset="30%" stopColor="#06b6d4" />
          <stop offset="70%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Pulsing dot cluster shown while AI is generating */
function ThinkingIndicator({ activity }: { activity?: AgentActivity | null }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 w-fit">
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-cyan-400"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-cyan-400 font-mono">
        {activity ?? "Processing…"}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export function DoctorAiPanel({
  messages,
  input,
  setInput,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  messagesEndRef,
  patientName,
  width,
  setWidth,
  isResizing,
  setIsResizing,
}: DoctorAiPanelProps) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  /* ── resize logic ─────────────────────────────────────────────── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const nw = window.innerWidth - e.clientX;
      if (nw >= 300 && nw <= 800) setWidth(nw);
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isResizing, setWidth, setIsResizing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const injectPrompt = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
      style={{ width, background: "hsl(var(--card)/0.3)" }}
    >
      {/* subtle grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* top-right glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/8 blur-3xl z-0" />

      {/* ── Resize handle ──────────────────────────────────────────── */}
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-50"
      >
        <div className="w-px h-full bg-transparent group-hover:bg-cyan-500/40 transition-colors duration-200" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-cyan-500/30 rounded-md p-1 shadow-lg">
          <GripVertical className="w-3.5 h-3.5 text-cyan-500" />
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 border-b border-border/60 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 h-[68px] flex items-center justify-between gap-4 shrink-0">
        <h2 className="font-display font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 text-sm tracking-wide">
          <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
          AI Clinical Assistant
        </h2>
        {patientName && (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {patientName}
            </span>
          </div>
        )}
      </div>

      {/* ── Messages area ──────────────────────────────────────────── */}
      <ScrollArea className="relative z-10 flex-1 min-h-0">
        <div className="p-4 space-y-5">

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[340px] gap-6 select-none">
              {/* ECG animation */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-1">
                  <Sparkles className="w-5 h-5 text-cyan-500" />
                </div>
                <EcgLine />
                <p className="text-[11px] font-mono text-cyan-500/60 tracking-[0.2em] uppercase">
                  System Ready
                </p>
              </div>

              {/* description */}
              <div className="text-center space-y-1 max-w-[220px]">
                <p className="text-sm font-medium text-foreground/80">
                  Clinical AI Assistant
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Ask about diagnosis, treatment options, or patient history
                </p>
              </div>

              {/* Quick prompts */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                {QUICK_PROMPTS.map(({ icon: Icon, label, text }) => (
                  <button
                    key={label}
                    onClick={() => injectPrompt(text)}
                    className="group flex flex-col items-start gap-1.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-left transition-all duration-150 hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:shadow-[0_0_12px_rgba(6,182,212,0.08)]"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <div
              key={message.id}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {message.role === MessageRole.USER ? (
                <UserMessage content={message.content} />
              ) : (
                <AgentMessage
                  content={message.content}
                  reasoning={message.reasoning}
                  toolCalls={message.toolCalls}
                  logs={message.logs}
                  timestamp={message.timestamp}
                  isLoading={isLoading}
                  isLatest={message.id === messages[messages.length - 1]?.id}
                  currentActivity={
                    message.id === messages[messages.length - 1]?.id
                      ? currentActivity
                      : null
                  }
                  activityDetails={
                    message.id === messages[messages.length - 1]?.id
                      ? activityDetails
                      : undefined
                  }
                  patientReferences={message.patientReferences}
                />
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {isLoading && messages.length > 0 && (
            <div className="animate-in fade-in duration-300">
              <ThinkingIndicator activity={currentActivity} />
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* ── Input bar ──────────────────────────────────────────────── */}
      <div className="relative z-10 shrink-0 border-t border-border/60 bg-background/40 backdrop-blur-sm p-3">
        <form onSubmit={handleSendMessage}>
          <div
            className="relative rounded-xl border transition-all duration-200"
            style={{
              borderColor: focused
                ? "hsl(var(--cyan-500, 188 100% 42%) / 0.5)"
                : "hsl(var(--border) / 0.8)",
              boxShadow: focused
                ? "0 0 0 3px hsl(188 100% 42% / 0.08), 0 0 20px hsl(188 100% 42% / 0.06)"
                : "none",
              background: "hsl(var(--card) / 0.6)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask about diagnosis, treatment, or patient history…"
              disabled={isLoading}
              rows={2}
              className="w-full resize-none bg-transparent px-3.5 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 font-sans leading-relaxed"
              style={{ maxHeight: 180 }}
            />

            {/* bottom row: hint + send */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
              <span className="text-[10px] text-muted-foreground/40 font-mono select-none">
                ↵ send · ⇧↵ newline
              </span>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() && !isLoading
                    ? "linear-gradient(135deg, #06b6d4, #14b8a6)"
                    : "hsl(var(--muted))",
                  boxShadow: input.trim() && !isLoading
                    ? "0 2px 12px hsl(188 100% 42% / 0.35)"
                    : "none",
                }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
