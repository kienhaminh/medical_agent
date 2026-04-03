"use client";

import { useState } from "react";
import { Brain, Terminal, Sparkles, Search, ChevronDown, ChevronRight } from "lucide-react";
import { ThinkingProgress } from "./thinking-progress";
import { ToolCallLog } from "./tool-call-log";
import { cn } from "@/lib/utils";
import type {
  AgentActivity,
  AgentProcessContainerProps,
} from "@/types/agent-ui";

const ACTIVITY_LABELS: Record<AgentActivity, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  thinking: { icon: Brain, label: "Thinking" },
  tool_calling: { icon: Terminal, label: "Using tools" },
  analyzing: { icon: Sparkles, label: "Analyzing" },
  searching: { icon: Search, label: "Searching" },
  processing: { icon: Sparkles, label: "Processing" },
};

export function AgentProcessContainer({
  reasoning,
  toolCalls,
  logs,
  isLatest,
  isLoading,
  currentActivity,
  activityDetails,
  tokenUsage,
}: AgentProcessContainerProps) {
  const [expanded, setExpanded] = useState(false);

  const hasContent = !!(
    reasoning ||
    (toolCalls && toolCalls.length > 0) ||
    (logs && logs.length > 0) ||
    tokenUsage
  );
  const showLoading = isLatest && isLoading;

  if (!hasContent && !showLoading) return null;

  const activity = currentActivity ? ACTIVITY_LABELS[currentActivity] : null;
  const ActivityIcon = activity?.icon ?? Brain;
  const activityLabel = activity?.label ?? "Working";

  return (
    <div className="space-y-1">
      {/* Status row */}
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          hasContent && "cursor-pointer hover:text-foreground transition-colors"
        )}
        onClick={hasContent ? () => setExpanded((v) => !v) : undefined}
      >
        {showLoading ? (
          <>
            {/* Animated dots */}
            <div className="flex items-center gap-0.5">
              <span
                className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "1.2s" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "200ms", animationDuration: "1.2s" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "400ms", animationDuration: "1.2s" }}
              />
            </div>
            <ActivityIcon className="w-3 h-3" />
            <span>{activityLabel}</span>
            {activityDetails && (
              <span className="truncate max-w-[280px] opacity-60">— {activityDetails}</span>
            )}
          </>
        ) : hasContent ? (
          <>
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Brain className="w-3 h-3" />
            <span>Thought process</span>
            {tokenUsage && (
              <span className="opacity-50 ml-1">
                · {tokenUsage.total_tokens.toLocaleString()} tokens
              </span>
            )}
          </>
        ) : null}
      </div>

      {/* Expandable content */}
      {hasContent && expanded && (
        <div className="ml-2 pl-3 border-l border-border/50 space-y-3 py-2">
          {(reasoning || (logs && logs.length > 0)) && (
            <ThinkingProgress reasoning={reasoning || ""} logs={logs} />
          )}
          {toolCalls && toolCalls.length > 0 && (
            <ToolCallLog toolCalls={toolCalls} />
          )}
        </div>
      )}
    </div>
  );
}
