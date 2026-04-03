"use client";

import { Sparkles } from "lucide-react";
import { AgentProcessContainer } from "./agent-process-container";
import { AnswerContent } from "./answer-content";
import type { AgentMessageProps } from "@/types/agent-ui";

export function AgentMessage({
  content,
  reasoning,
  toolCalls,
  logs,
  isLoading,
  isLatest,
  currentActivity,
  activityDetails,
  patientReferences,
  sessionId,
  tokenUsage,
}: AgentMessageProps) {
  // Show thinking box only during active streaming
  const shouldShowThinking = Boolean(isLatest && isLoading);

  return (
    <div className="flex gap-3 px-1">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
        {shouldShowThinking && (
          <AgentProcessContainer
            reasoning={reasoning}
            toolCalls={toolCalls}
            logs={logs}
            isLatest={isLatest}
            isLoading={isLoading}
            currentActivity={currentActivity}
            activityDetails={activityDetails}
            tokenUsage={tokenUsage}
          />
        )}

        {content && (
          <AnswerContent
            content={content}
            isLoading={isLoading}
            isLatest={isLatest}
            patientReferences={patientReferences}
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  );
}
