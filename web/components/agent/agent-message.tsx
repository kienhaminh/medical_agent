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
  // Show thinking box only during active streaming
  // Once streaming completes, hide the thinking box to keep the UI clean
  const shouldShowThinking = Boolean(isLatest && isLoading);

  return (
    <div className="flex gap-4">
      {/* Message Content */}
      <div className="flex-1 space-y-1">
        {/* Agent Process Container (Thinking Box)
            - Shows only during active streaming
            - Automatically hides when streaming completes
            - Displays reasoning, tool calls, logs, and progress
        */}
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

        {/* Answer Content
            - Appears as content streams in
            - Updates progressively during streaming
            - Remains visible after streaming completes
        */}
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
