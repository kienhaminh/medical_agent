"use client";

import React, { RefObject, useEffect, useRef, useState } from "react";
import { Sparkles, GripVertical, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiInsightsMode } from "./ai-insights-mode";
import { AiChatMode } from "./ai-chat-mode";
import type { AgentActivity, Message } from "@/types/agent-ui";
import type { WSEvent } from "@/lib/ws-events";

type AiMode = "insights" | "chat";

interface DoctorAiPanelProps {
  // Chat props
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;

  // Insights props
  wsEvents: WSEvent[];

  // Panel props
  patientName?: string;
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
  onResetChat?: () => void;
}

const MODE_TABS: { key: AiMode; label: string; icon: typeof Lightbulb }[] = [
  { key: "insights", label: "Insights", icon: Lightbulb },
  { key: "chat", label: "Chat", icon: MessageSquare },
];

export function DoctorAiPanel({
  messages,
  input,
  setInput,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  messagesEndRef,
  wsEvents,
  patientName,
  width,
  setWidth,
  isResizing,
  setIsResizing,
  onResetChat,
}: DoctorAiPanelProps) {
  const [activeMode, setActiveMode] = useState<AiMode>("insights");
  const panelRef = useRef<HTMLDivElement>(null);
  const dragAnchorRef = useRef<number>(0);

  // Capture right edge at drag start
  const handleResizeStart = () => {
    if (panelRef.current) {
      dragAnchorRef.current = panelRef.current.getBoundingClientRect().right;
    }
    setIsResizing(true);
  };

  // Resize logic
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const nw = dragAnchorRef.current - e.clientX;
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

  // Switch to chat mode when user asks AI from insights
  const handleAskAi = (question: string) => {
    setInput(question);
    setActiveMode("chat");
  };

  return (
    <div
      ref={panelRef}
      className="relative flex flex-col h-full border-l border-border/50 overflow-hidden shrink-0 bg-card/25"
      style={{ width }}
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/6 blur-3xl z-0" />

      {/* dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-50"
      >
        <div className="w-px h-full bg-transparent group-hover:bg-primary/30 transition-colors duration-200" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border border-border/60 rounded p-0.5 shadow-md">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      {/* Header */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4 h-14 border-b border-border/50"
        style={{ background: "linear-gradient(90deg, hsl(var(--primary)/0.07) 0%, transparent 70%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-wide">AI Assistant</span>
        </div>

        {patientName && (
          <div className="flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" />
            <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[120px]">
              {patientName}
            </span>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="relative z-10 shrink-0 flex border-b border-border/50">
        {MODE_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              activeMode === key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Mode content */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        {activeMode === "insights" && (
          <AiInsightsMode
            onAskAi={handleAskAi}
          />
        )}

        {activeMode === "chat" && (
          <AiChatMode
            messages={messages}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            currentActivity={currentActivity}
            activityDetails={activityDetails}
            handleSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef}
            onResetChat={onResetChat}
          />
        )}
      </div>
    </div>
  );
}
