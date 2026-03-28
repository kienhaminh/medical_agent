"use client";

import React, { RefObject, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, GripVertical, Activity } from "lucide-react";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import { PreVisitBriefCard } from "@/components/doctor/pre-visit-brief-card";
import type { AgentActivity } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import "highlight.js/styles/github-dark.css";

// Import Message type from the hook
import type { Message } from "@/types/agent-ui";

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
  visitBrief?: string;
  briefLoading?: boolean;
  // Resize
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
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
  visitBrief,
  briefLoading,
  width,
  setWidth,
  isResizing,
  setIsResizing,
}: DoctorAiPanelProps) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize logic — mirrors ai-assistant-panel.tsx
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth, setIsResizing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div
      className="relative border-l border-border/50 bg-card/30 backdrop-blur-xl flex flex-col h-full"
      style={{ width }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-50"
      >
        {/* Visible line on hover */}
        <div className="w-0.5 h-full bg-transparent group-hover:bg-cyan-500/50 transition-colors" />

        {/* Grip icon */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm border border-cyan-500/30 rounded-md p-1 shadow-sm">
          <GripVertical className="w-4 h-4 text-cyan-500" />
        </div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-cyan-500/10 to-teal-500/10">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-500" />
          AI Clinical Assistant
        </h2>
        {patientName && (
          <p className="text-xs text-muted-foreground mt-1">
            Context: {patientName}
          </p>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {/* Pre-visit brief card — auto-loads when a patient is selected */}
        <PreVisitBriefCard brief={visitBrief ?? ""} loading={briefLoading ?? false} />

        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-10 space-y-4">
            <div className="inline-flex p-4 rounded-full bg-cyan-500/10">
              <Activity className="w-8 h-8 text-cyan-500" />
            </div>
            <div>
              <p className="font-medium">AI Ready</p>
              <p className="text-sm mt-2 max-w-xs mx-auto">
                Ask about patient records, differential diagnosis, or clinical
                recommendations
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
          {messages.map((message, index) => (
            <div key={message.id} style={{ animationDelay: `${index * 50}ms` }}>
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
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about diagnosis, treatment, or patient history... (Enter to send)"
              className="min-h-[80px] max-h-[200px] resize-none pr-12 text-sm"
              disabled={isLoading}
            />
            <div className="absolute right-3 bottom-3">
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="h-8 w-8"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
