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
  return (
    <div className="flex gap-3 px-1">
      {/* Content */}
      <div className="flex-1 space-y-2 min-w-0">
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
