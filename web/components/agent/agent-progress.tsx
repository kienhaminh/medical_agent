"use client";

import { Brain, Terminal, Sparkles, Search } from "lucide-react";
import { Card } from "@/components/ui/card";

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

const ACTIVITY_CONFIG: Record<AgentActivity, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  thinking: {
    icon: Brain,
    label: "Thinking",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  tool_calling: {
    icon: Terminal,
    label: "Using Tools",
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  analyzing: {
    icon: Sparkles,
    label: "Analyzing",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10"
  },
  searching: {
    icon: Search,
    label: "Searching",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  processing: {
    icon: Sparkles,
    label: "Processing",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10"
  }
};

export function AgentProgress({ activity, details }: AgentProgressProps) {
  const config = ACTIVITY_CONFIG[activity];
  const Icon = config.icon;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="p-4 bg-card/50 border-border/50 record-card">
        <div className="flex items-center gap-3">
          {/* Animated Icon */}
          <div className={`p-2 rounded-lg ${config.bgColor} ${config.color} animate-pulse`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Activity Label */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
              {/* Animated Dots */}
              <div className="flex gap-1">
                <div className={`w-1.5 h-1.5 ${config.bgColor} rounded-full animate-bounce`} style={{ animationDelay: "0ms" }} />
                <div className={`w-1.5 h-1.5 ${config.bgColor} rounded-full animate-bounce`} style={{ animationDelay: "150ms" }} />
                <div className={`w-1.5 h-1.5 ${config.bgColor} rounded-full animate-bounce`} style={{ animationDelay: "300ms" }} />
              </div>
            </div>

            {/* Details */}
            {details && (
              <p className="text-xs text-muted-foreground mt-1">
                {details}
              </p>
            )}
          </div>

          {/* Spinner */}
          <div className={`w-5 h-5 border-2 border-transparent ${config.bgColor} rounded-full animate-spin`}>
            <div className={`w-full h-full border-2 ${config.color} border-t-transparent rounded-full`} />
          </div>
        </div>
      </Card>
    </div>
  );
}
