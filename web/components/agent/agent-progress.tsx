"use client";

import { Brain, Terminal, Sparkles, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AgentActivity =
  | "thinking"
  | "tool_calling"
  | "analyzing"
  | "searching"
  | "processing";

interface AgentProgressProps {
  activity: AgentActivity;
  details?: string;
}

const ACTIVITY_CONFIG: Record<
  AgentActivity,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  thinking: {
    icon: Brain,
    label: "Thinking",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  tool_calling: {
    icon: Terminal,
    label: "Executing Tools",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  analyzing: {
    icon: Sparkles,
    label: "Analyzing",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  searching: {
    icon: Search,
    label: "Searching",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  processing: {
    icon: Sparkles,
    label: "Processing",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
  },
};

export function AgentProgress({ activity, details }: AgentProgressProps) {
  const config = ACTIVITY_CONFIG[activity];
  const Icon = config.icon;
  const isThinking = activity === "thinking";

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden",
        isThinking && "p-[2px]"
      )}
    >
      {isThinking && (
        <div className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_120deg,#a855f7_180deg,transparent_180deg_300deg,#a855f7_360deg)]" />
      )}
      <Card
        className={cn(
          "p-3 h-full w-full",
          isThinking
            ? "bg-card/95 backdrop-blur-xl border-transparent"
            : "bg-card/50 border-border/50"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
              <div className="flex gap-1">
                <div
                  className={`w-1 h-1 ${config.color} rounded-full animate-bounce`}
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className={`w-1 h-1 ${config.color} rounded-full animate-bounce`}
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className={`w-1 h-1 ${config.color} rounded-full animate-bounce`}
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>

            {details && (
              <p className="text-xs text-muted-foreground">{details}</p>
            )}
          </div>

          {/* Spinner */}
          <div
            className={`w-5 h-5 border-2 border-muted-foreground/30 border-t-current ${config.color} rounded-full animate-spin`}
          />
        </div>
      </Card>
    </div>
  );
}
