"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { ThinkingProgress } from "./thinking-progress";
import { ToolCallLog } from "./tool-call-log";
import type { ToolCall } from "./tool-call-item";

interface AgentProcessContainerProps {
  reasoning?: string;
  toolCalls?: ToolCall[];
}

export function AgentProcessContainer({ reasoning, toolCalls }: AgentProcessContainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning && (!toolCalls || toolCalls.length === 0)) return null;

  const toolCount = toolCalls?.length || 0;
  const hasReasoning = !!reasoning;

  return (
    <div className="border border-border/50 rounded-lg bg-card/30 overflow-hidden text-sm mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-purple-500/10 text-purple-500">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium text-xs">
              Agent Process
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasReasoning && <span>Reasoning</span>}
              {hasReasoning && toolCount > 0 && <span>•</span>}
              {toolCount > 0 && <span>{toolCount} tool{toolCount > 1 ? 's' : ''} used</span>}
            </div>
          </div>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="border-t border-border/50 bg-muted/20">
          {reasoning && <ThinkingProgress reasoning={reasoning} />}
          {toolCalls && toolCalls.length > 0 && <ToolCallLog toolCalls={toolCalls} />}
        </div>
      )}
    </div>
  );
}
