"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import type { ToolCall, ToolCallItemProps } from "@/types/agent-ui";

export function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isComplete = !!toolCall.result;

  return (
    <div className="border border-border/50 rounded bg-background/30 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-foreground/80">
            {toolCall.tool}
          </span>
          {isComplete ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <div className="w-3 h-3 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 border-t border-border/50 bg-muted/10 space-y-2">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 font-medium">
              Arguments
            </div>
            <pre className="text-[10px] bg-background/50 p-2 rounded overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1 font-medium">
                Result
              </div>
              <pre className="text-[10px] bg-background/50 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed max-h-40">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
