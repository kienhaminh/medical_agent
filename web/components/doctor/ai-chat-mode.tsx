"use client";

import React, { RefObject, useCallback, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, UserRound, FileText, Stethoscope, Zap, Pill } from "lucide-react";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import { ChatInputArea, type ChatInputAreaHandle } from "./chat-input-area";
import type { AgentActivity, Message } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";

const QUICK_PROMPTS = [
  { icon: FileText, label: "Summarize", text: "Summarize this patient's medical history and current condition." },
  { icon: Stethoscope, label: "Differential", text: "What are the top differential diagnoses based on the current presentation?" },
  { icon: Zap, label: "Treatment", text: "Suggest a treatment plan based on the patient's records." },
  { icon: Pill, label: "Drug check", text: "Check for potential drug interactions in the current medication list." },
];

interface AiChatModeProps {
  messages: Message[];
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (message: string) => void;
  onStopAgent?: () => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onResetChat?: () => void;
  hasPatient?: boolean;
  visitId?: number;
  onTranscribed?: (text: string) => void;
}

function EcgLine() {
  return (
    <svg
      viewBox="0 0 320 60"
      className="w-full max-w-[240px] h-[48px] text-primary"
      fill="none"
    >
      <style>{`
        @keyframes ecg-loop {
          0%   { stroke-dashoffset: 700; }
          60%  { stroke-dashoffset: 0; }
          80%  { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -700; opacity: 0; }
        }
        .ecg-path { stroke-dasharray: 700; animation: ecg-loop 3s ease-in-out infinite; }
        .ecg-stop-fade { stop-color: currentColor; stop-opacity: 0; }
        .ecg-stop-solid { stop-color: currentColor; stop-opacity: 1; }
      `}</style>
      <defs>
        <linearGradient id="ecgGradChat" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" className="ecg-stop-fade" />
          <stop offset="30%" className="ecg-stop-solid" />
          <stop offset="70%" className="ecg-stop-solid" />
          <stop offset="100%" className="ecg-stop-fade" />
        </linearGradient>
      </defs>
      <path
        className="ecg-path"
        d="M0 30 L40 30 L55 30 L65 8 L72 52 L80 30 L95 30 L105 30 L112 18 L118 42 L124 30 L160 30 L170 30 L178 12 L185 48 L192 30 L210 30 L220 30 L228 20 L234 40 L240 30 L280 30 L320 30"
        stroke="url(#ecgGradChat)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AiChatMode({
  messages,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  onStopAgent,
  messagesEndRef,
  onResetChat,
  hasPatient = true,
  visitId,
  onTranscribed,
}: AiChatModeProps) {
  const isEmpty = messages.length === 0;
  const chatInputRef = useRef<ChatInputAreaHandle>(null);
  // Increment to signal ChatInputArea to clear its input
  const [resetKey, setResetKey] = useState(0);
  const lastMessageId = messages[messages.length - 1]?.id;

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    onResetChat?.();
  }, [onResetChat]);

  if (!hasPatient) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 select-none p-6">
        <div className="w-9 h-9 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
          <UserRound className="w-4.5 h-4.5 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground/50">No patient selected</p>
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Select a patient from the list to start chatting with the AI assistant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]>div]:!min-w-0">
        <div className="p-4 space-y-4">
          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[280px] gap-5 select-none">
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-primary" />
                </div>
                <EcgLine />
                <p className="text-[10px] font-mono text-primary/50 tracking-[0.25em] uppercase mt-1">
                  System Ready
                </p>
              </div>
              <div className="text-center space-y-1 max-w-[200px]">
                <p className="text-sm font-medium text-foreground/70">Clinical AI Assistant</p>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  Ask about diagnosis, treatment, or patient history
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map(({ icon: Icon, label, text }) => (
                  <button
                    key={label}
                    onClick={() => chatInputRef.current?.inject(text)}
                    className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-border/50 bg-muted/20
                               text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30
                               hover:bg-primary/5 transition-all duration-150"
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <div
              key={message.id}
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
                  isLatest={message.id === lastMessageId}
                  currentActivity={message.id === lastMessageId ? currentActivity : null}
                  activityDetails={message.id === lastMessageId ? activityDetails : undefined}
                  patientReferences={message.patientReferences}
                />
              )}
            </div>
          ))}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* Input — isolated component so typing never re-renders the message list */}
      <ChatInputArea
        ref={chatInputRef}
        hasMessages={!isEmpty}
        isLoading={isLoading}
        onSubmit={handleSendMessage}
        onStop={onStopAgent}
        onReset={handleReset}
        visitId={visitId}
        onTranscribed={onTranscribed}
        resetKey={resetKey}
      />
    </div>
  );
}
