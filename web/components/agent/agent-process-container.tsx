"use client";

import { Brain, Loader2, Terminal, Sparkles, Search } from "lucide-react";
import { ThinkingProgress, type LogItem } from "./thinking-progress";
import { ToolCallLog } from "./tool-call-log";
import type { ToolCall } from "./tool-call-item";
import { cn } from "@/lib/utils";
import type { AgentActivity } from "./agent-progress";

interface AgentProcessContainerProps {
  reasoning?: string;
  toolCalls?: ToolCall[];
  logs?: LogItem[];
  isLatest?: boolean;
  isLoading?: boolean;
  currentActivity?: AgentActivity | null;
  activityDetails?: string;
}

const ACTIVITY_CONFIG: Record<
  AgentActivity,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    shadowColor: string;
    glowColor: string;
  }
> = {
  thinking: {
    icon: Brain,
    label: "Thinking",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/50",
    shadowColor: "shadow-purple-500/25",
    glowColor: "bg-purple-500",
  },
  tool_calling: {
    icon: Terminal,
    label: "Executing Tools",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/50",
    shadowColor: "shadow-green-500/25",
    glowColor: "bg-green-500",
  },
  analyzing: {
    icon: Sparkles,
    label: "Analyzing",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/50",
    shadowColor: "shadow-cyan-500/25",
    glowColor: "bg-cyan-500",
  },
  searching: {
    icon: Search,
    label: "Searching",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/50",
    shadowColor: "shadow-blue-500/25",
    glowColor: "bg-blue-500",
  },
  processing: {
    icon: Sparkles,
    label: "Processing",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/50",
    shadowColor: "shadow-teal-500/25",
    glowColor: "bg-teal-500",
  },
};

export function AgentProcessContainer({
  reasoning,
  toolCalls,
  logs,
  isLatest,
  isLoading,
  currentActivity,
  activityDetails,
}: AgentProcessContainerProps) {
  const hasContent = !!(
    reasoning ||
    (toolCalls && toolCalls.length > 0) ||
    (logs && logs.length > 0)
  );
  const showLoading = isLatest && isLoading;

  if (!hasContent && !showLoading) return null;

  const isActive = showLoading;
  const activityConfig =
    isActive && currentActivity ? ACTIVITY_CONFIG[currentActivity] : null;

  // Default state (finished or no specific activity)
  const defaultConfig = {
    icon: Brain,
    label: "Thought Process",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-transparent",
    shadowColor: "shadow-transparent",
    glowColor: "bg-transparent",
  };

  const config = activityConfig || defaultConfig;
  const Icon = config.icon;

  return (
    <div className="mb-2 relative group">
      {isActive && (
        <div
          className={cn(
            "absolute -inset-0.5 rounded-lg blur opacity-20 transition-all duration-1000 animate-pulse",
            config.glowColor
          )}
        />
      )}
      <div
        className={cn(
          "relative rounded-lg overflow-hidden border transition-all duration-500",
          isActive
            ? cn("bg-card/50", config.borderColor)
            : "bg-card/50 border-border/50"
        )}
      >
        <div
          className={cn(
            "w-full flex items-center gap-3 p-2 text-xs transition-all duration-200 rounded-lg",
            "bg-muted/30"
          )}
        >
          <div
            className={cn(
              "p-1.5 rounded-md transition-colors relative",
              isActive
                ? `${config.bgColor} ${config.color}`
                : "bg-muted text-muted-foreground"
            )}
          >
            {isActive ? (
              <>
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span
                  className={cn(
                    "absolute inset-0 rounded-md opacity-50 animate-pulse",
                    config.bgColor
                  )}
                />
              </>
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 w-full">
              <span
                className={cn(
                  "font-medium",
                  isActive ? config.color : "text-foreground/80"
                )}
              >
                {isActive ? config.label : "Thought Process"}
              </span>

              {isActive && (
                <div className="flex gap-0.5 ml-1">
                  <div
                    className={`w-0.5 h-0.5 ${config.color} rounded-full animate-bounce`}
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className={`w-0.5 h-0.5 ${config.color} rounded-full animate-bounce`}
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className={`w-0.5 h-0.5 ${config.color} rounded-full animate-bounce`}
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              )}
            </div>

            {isActive && activityDetails && (
              <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                {activityDetails}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <Loader2 className={cn("w-3 h-3 animate-spin", config.color)} />
            )}
          </div>
        </div>

        {hasContent && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30 mt-1">
            {(reasoning || (logs && logs.length > 0)) && (
              <ThinkingProgress reasoning={reasoning || ""} logs={logs} />
            )}
            {toolCalls && toolCalls.length > 0 && (
              <ToolCallLog toolCalls={toolCalls} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
