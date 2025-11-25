"use client";

import React, { RefObject, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Send,
  GripVertical,
  History,
  Activity,
  RefreshCw,
} from "lucide-react";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import type { PatientWithDetails } from "@/lib/mock-data";
import { Message, AgentActivity } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import "highlight.js/styles/github-dark.css";

interface AiAssistantPanelProps {
  aiOpen: boolean;
  aiWidth: number;
  setAiWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
  messages: Message[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
  loadingSession: boolean;
  handleSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  patient: PatientWithDetails;
  activeTab: string;
  sessionId: string | null;
  onClearChat?: () => void;
}

export function AiAssistantPanel({
  aiOpen,
  aiWidth,
  setAiWidth,
  isResizing,
  setIsResizing,
  messages,
  input,
  setInput,
  isLoading,
  currentActivity,
  activityDetails,
  loadingSession,
  handleSendMessage,
  messagesEndRef,
  patient,
  activeTab,
  sessionId,
  onClearChat,
}: AiAssistantPanelProps) {
  const router = useRouter();
  const resizeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setAiWidth(newWidth);
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
  }, [isResizing, setAiWidth, setIsResizing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  if (!aiOpen) return null;

  return (
    <div
      className="relative border-l border-border/50 bg-card/30 backdrop-blur-xl flex flex-col h-full"
      style={{ width: aiWidth }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-50"
      >
        {/* Visible Line */}
        <div className="w-0.5 h-full bg-transparent group-hover:bg-cyan-500/50 transition-colors" />

        {/* Grip Icon */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm border border-cyan-500/30 rounded-md p-1 shadow-sm">
          <GripVertical className="w-4 h-4 text-cyan-500" />
        </div>
      </div>

      {/* AI Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-cyan-500/10 to-teal-500/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              AI Medical Assistant
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Context: {patient.name} • {activeTab}
            </p>
          </div>
          {onClearChat && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearChat}
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              title="Clear Chat"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
        {sessionId && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="medical-badge-text text-xs">
              <History className="w-3 h-3 mr-1" />
              Continuing Chat Session
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/agent?session=${sessionId}`)}
              className="text-xs h-6 px-2 hover:bg-cyan-500/10 hover:text-cyan-400"
            >
              Back to Chat
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loadingSession ? (
          <div className="text-center text-muted-foreground mt-10 space-y-4">
            <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
            <div>
              <p className="font-medium">Loading chat session...</p>
            </div>
          </div>
        ) : (
          messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-10 space-y-4">
              <div className="inline-flex p-4 rounded-full bg-cyan-500/10">
                <Activity className="w-8 h-8 text-cyan-500" />
              </div>
              <div>
                <p className="font-medium">AI Ready</p>
                <p className="text-sm mt-2">
                  Ask about {patient.name}'s medical records
                </p>
              </div>
            </div>
          )
        )}

        <div className="space-y-6">
          {messages.map((message, index) => (
            <div key={message.id} style={{ animationDelay: `${index * 50}ms` }}>
              {message.role === MessageRole.USER ? (
                <UserMessage
                  content={message.content}
                  timestamp={message.timestamp}
                />
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
                  sessionId={sessionId || undefined}
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
              placeholder="Ask about medical records... (Enter to send, Shift+Enter for new line)"
              className="min-h-[80px] max-h-[200px] resize-none pr-12 medical-input text-sm"
              disabled={isLoading}
            />
            <div className="absolute right-3 bottom-3">
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="primary-button h-8 w-8"
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
