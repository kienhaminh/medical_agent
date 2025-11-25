"use client";

import { Card } from "@/components/ui/card";
import type { UserMessageProps } from "@/types/agent-ui";

export function UserMessage({ content, timestamp }: UserMessageProps) {
  return (
    <div className="flex justify-end gap-4">
      {/* Message Content */}
      <div className="max-w-[80%]">
        <Card className="p-4 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 medical-border-glow">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {content}
          </p>
        </Card>
      </div>
    </div>
  );
}
