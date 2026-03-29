"use client";

import React, { RefObject, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, FileText, Stethoscope, Zap, Pill } from "lucide-react";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import type { AgentActivity, Message } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";

interface AiChatModeProps {
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

const QUICK_PROMPTS = [
  { icon: FileText,    label: "Summarize",    text: "Summarize this patient's medical history and current condition." },
  { icon: Stethoscope, label: "Differential", text: "What are the top differential diagnoses based on the current presentation?" },
  { icon: Zap,         label: "Treatment",    text: "Suggest a treatment plan based on the patient's records." },
  { icon: Pill,        label: "Drug check",   text: "Check for potential drug interactions in the current medication list." },
];

function EcgLine() {
  return (
    <svg viewBox="0 0 320 60" className="w-full max-w-[240px] h-[48px]" fill="none">
      <style>{`
        @keyframes ecg-loop {
          0%   { stroke-dashoffset: 700; }
          60%  { stroke-dashoffset: 0; }
          80%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -700; opacity: 0; }
        }
        .ecg-path { stroke-dasharray: 700; animation: ecg-loop 3s ease-in-out infinite; }
      `}</style>
      <path
        className="ecg-path"
        d="M0 30 L40 30 L55 30 L65 8 L72 52 L80 30 L95 30 L105 30 L112 18 L118 42 L124 30 L160 30 L170 30 L178 12 L185 48 L192 30 L210 30 L220 30 L228 20 L234 40 L240 30 L280 30 L320 30"
        stroke="url(#ecgGradChat)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="ecgGradChat" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0" />
          <stop offset="30%"  stopColor="#06b6d4" />
          <stop offset="70%"  stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ThinkingIndicator({ activity }: { activity?: AgentActivity | null }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 w-fit">
      <style>{`
        @keyframes blink { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block w-1 h-1 rounded-full bg-cyan-400"
            style={{ animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span className="text-[11px] text-cyan-400 font-mono">{activity ?? "Processing..."}</span>
    </div>
  );
}

export function AiChatMode({
  messages,
  input,
  setInput,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  messagesEndRef,
}: AiChatModeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const isEmpty = messages.length === 0;

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[280px] gap-5 select-none">
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-cyan-500" />
                </div>
                <EcgLine />
                <p className="text-[10px] font-mono text-cyan-500/50 tracking-[0.25em] uppercase mt-1">
                  System Ready
                </p>
              </div>

              <div className="text-center space-y-1 max-w-[200px]">
                <p className="text-sm font-medium text-foreground/70">Clinical AI Assistant</p>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  Ask about diagnosis, treatment, or patient history
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 w-full max-w-[260px]">
                {QUICK_PROMPTS.map(({ icon: Icon, label, text }) => (
                  <button
                    key={label}
                    onClick={() => injectPrompt(text)}
                    className="group flex flex-col items-start gap-1.5 rounded-lg border border-border/50 bg-white/[0.02] px-3 py-2.5 text-left
                               transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-cyan-400 transition-colors" />
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
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
                  currentActivity={message.id === messages[messages.length - 1]?.id ? currentActivity : null}
                  activityDetails={message.id === messages[messages.length - 1]?.id ? activityDetails : undefined}
                  patientReferences={message.patientReferences}
                />
              )}
            </div>
          ))}

          {isLoading && messages.length > 0 && (
            <div className="animate-in fade-in duration-300">
              <ThinkingIndicator activity={currentActivity} />
            </div>
          )}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/50 p-3">
        <form onSubmit={handleSendMessage}>
          <div
            className="relative rounded-xl border transition-all duration-200"
            style={{
              borderColor: focused ? "rgba(6,182,212,0.45)" : "hsl(var(--border)/0.7)",
              boxShadow: focused ? "0 0 0 3px rgba(6,182,212,0.07), 0 0 16px rgba(6,182,212,0.05)" : "none",
              background: "hsl(var(--card)/0.5)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask about diagnosis, treatment, or patient history..."
              disabled={isLoading}
              rows={2}
              className="w-full resize-none bg-transparent px-3.5 pt-3 pb-10 text-sm text-foreground
                         placeholder:text-muted-foreground/35 focus:outline-none disabled:opacity-50
                         leading-relaxed"
              style={{ maxHeight: 180 }}
            />

            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
              <span className="text-[10px] text-muted-foreground/30 font-mono select-none">
                ↵ send · ⇧↵ newline
              </span>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() && !isLoading
                    ? "linear-gradient(135deg, #06b6d4, #14b8a6)"
                    : "hsl(var(--muted))",
                  boxShadow: input.trim() && !isLoading ? "0 2px 10px rgba(6,182,212,0.3)" : "none",
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
