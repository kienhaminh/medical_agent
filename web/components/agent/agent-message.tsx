"use client";

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
  // Show thinking box only while the assistant is actively responding
  const shouldShowThinking = Boolean(isLatest && isLoading);

  return (
    <div className="flex gap-4">
      {/* Message Content */}
      <div className="flex-1 space-y-1">
        {/* Agent Process (Collapsible) - Hide when answer starts unless we have data */}
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
