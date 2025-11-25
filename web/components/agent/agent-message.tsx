"use client";

import { AgentProcessContainer } from "./agent-process-container";
import { AnswerContent } from "./answer-content";
import type { AgentMessageProps } from "@/types/agent-ui";

export function AgentMessage({
  content,
  reasoning,
  toolCalls,
  logs,
  timestamp,
  isLoading,
  isLatest,
  currentActivity,
  activityDetails,
  patientReferences,
  sessionId,
}: AgentMessageProps) {
  // Hide thinking box once answer content starts streaming
  // Show only during initial loading phase before content arrives
  const shouldShowThinking = isLoading && !content;

  return (
    <div className="flex gap-4">
      {/* Message Content */}
      <div className="flex-1 space-y-1">
        {/* Agent Process (Collapsible) - Hide when answer starts */}
        {shouldShowThinking && (
          <AgentProcessContainer
            reasoning={reasoning}
            toolCalls={toolCalls}
            logs={logs}
            isLatest={isLatest}
            isLoading={isLoading}
            currentActivity={currentActivity}
            activityDetails={activityDetails}
          />
        )}

        {/* Answer (Always Visible) */}
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
