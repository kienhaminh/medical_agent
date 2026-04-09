"use client";

import { ToolCallItem } from "./tool-call-item";
import type { ToolCallLogProps } from "@/types/agent-ui";

export function ToolCallLog({ toolCalls }: ToolCallLogProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-4">
      {toolCalls.map((toolCall) => (
        <ToolCallItem key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}
