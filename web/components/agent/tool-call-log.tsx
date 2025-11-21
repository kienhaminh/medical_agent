"use client";

import { Terminal } from "lucide-react";
import { ToolCallItem, type ToolCall } from "./tool-call-item";

interface ToolCallLogProps {
  toolCalls: ToolCall[];
}

export function ToolCallLog({ toolCalls }: ToolCallLogProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded bg-green-500/10 text-green-500">
          <Terminal className="w-3 h-3" />
        </div>
        <span className="font-mono text-xs font-medium text-muted-foreground">
          Tool Calls ({toolCalls.length})
        </span>
      </div>
      <div className="space-y-2 pl-6">
        {toolCalls.map((toolCall) => (
          <ToolCallItem key={toolCall.id} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}
