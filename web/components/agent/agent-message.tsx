"use client";

import { Sparkles } from "lucide-react";
import { AgentProcessContainer } from "./agent-process-container";
import { AnswerContent } from "./answer-content";
import { AgentProgress, type AgentActivity } from "./agent-progress";
import type { ToolCall } from "./tool-call-item";
import type { LogItem } from "./thinking-progress";

interface AgentMessageProps {
  content?: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  logs?: LogItem[];
  timestamp: Date;
  isLoading?: boolean;
  isLatest?: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
}

export function AgentMessage({
  content,
  reasoning,
  toolCalls,
  logs,
  timestamp,
  isLoading,
  isLatest,
  currentActivity,
  activityDetails
}: AgentMessageProps) {
  return (
    <div className="flex gap-4">
      {/* AI Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center border border-cyan-500/30">
          <Sparkles className="w-5 h-5 text-cyan-500 animate-pulse" />
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 space-y-1">
        {/* Agent Process (Collapsible) */}
        <AgentProcessContainer 
          reasoning={reasoning} 
          toolCalls={toolCalls} 
          logs={logs} 
          isLatest={isLatest}
          isLoading={isLoading}
          currentActivity={currentActivity}
          activityDetails={activityDetails}
        />

        {/* Answer (Always Visible) */}
        {content && (
          <AnswerContent
            content={content}
            isLoading={isLoading}
            isLatest={isLatest}
          />
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
          <span className="font-medium text-cyan-500">AI Assistant</span>
          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
          <span>{timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}
