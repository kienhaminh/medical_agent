"use client";

import React, { RefObject, useEffect, useReducer, useRef, useState } from "react";
import { Sparkles, GripVertical, ChevronLeft } from "lucide-react";
import { AiChatMode } from "./ai-chat-mode";
import type { AgentActivity, Message } from "@/types/agent-ui";

const COLLAPSE_THRESHOLD = 240;
const DEFAULT_WIDTH = 420;
const MAX_WIDTH = 800;

interface DoctorAiPanelProps {
  messages: Message[];
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  handleSendMessage: (message: string) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  patientName?: string;
  onResetChat?: () => void;
  onStopAgent?: () => void;
  visitId?: number;
  onTranscribed?: (text: string) => void;
}

export function DoctorAiPanel({
  messages,
  isLoading,
  currentActivity,
  activityDetails,
  handleSendMessage,
  messagesEndRef,
  patientName,
  onResetChat,
  onStopAgent,
  visitId,
  onTranscribed,
}: DoctorAiPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  // forceUpdate syncs React after drag ends — width lives in a ref during drag
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const dragAnchorRef = useRef(0);
  // Source of truth for width — ref avoids React state updates every pixel
  const widthRef = useRef(DEFAULT_WIDTH);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cleanupDrag = () => {
      isResizingRef.current = false;
      overlayRef.current?.remove();
      overlayRef.current = null;
      if (panelRef.current) panelRef.current.style.willChange = "";
    };

    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !panelRef.current) return;
      const nw = dragAnchorRef.current - e.clientX;
      if (nw < COLLAPSE_THRESHOLD) {
        cleanupDrag();
        widthRef.current = DEFAULT_WIDTH;
        panelRef.current.style.width = `${DEFAULT_WIDTH}px`;
        setCollapsed(true);
        forceUpdate();
        return;
      }
      if (nw <= MAX_WIDTH) {
        widthRef.current = nw;
        // Direct DOM mutation — zero React renders during drag
        panelRef.current.style.width = `${nw}px`;
      }
    };

    const onUp = () => {
      if (!isResizingRef.current) return;
      cleanupDrag();
      // One re-render to commit final width into React's vdom
      forceUpdate();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleResizeStart = () => {
    const panel = panelRef.current;
    if (!panel) return;

    dragAnchorRef.current = panel.getBoundingClientRect().right;
    panel.style.willChange = "width";

    // Full-page overlay: captures all mouse events, prevents hover-state
    // recalculations on all content, and keeps ew-resize cursor everywhere.
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:ew-resize;";
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    isResizingRef.current = true;
  };

  if (collapsed) {
    return (
      <div
        className="relative flex flex-col h-full border-l border-border/50 shrink-0 w-10 bg-card/25 items-center justify-center group cursor-pointer"
        onClick={() => setCollapsed(false)}
        title="Show AI Assistant"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <ChevronLeft className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      // widthRef.current is always the correct drag width — if a parent
      // re-renders during drag this renders the right value, not stale state
      style={{ width: widthRef.current }}
      className="relative flex flex-col h-full border-l border-border/50 overflow-hidden shrink-0 bg-card/25"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/6 blur-3xl z-0" />

      {/* dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
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
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--primary)/0.07) 0%, transparent 70%)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-wide">
            AI Assistant
          </span>
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

      {/* Chat */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <AiChatMode
          messages={messages}
          isLoading={isLoading}
          currentActivity={currentActivity}
          activityDetails={activityDetails}
          handleSendMessage={handleSendMessage}
          onStopAgent={onStopAgent}
          messagesEndRef={messagesEndRef}
          onResetChat={onResetChat}
          hasPatient={!!patientName}
          visitId={visitId}
          onTranscribed={onTranscribed}
        />
      </div>
    </div>
  );
}
