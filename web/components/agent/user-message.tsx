"use client";

import { Card } from "@/components/ui/card";
import type { UserMessageProps } from "@/types/agent-ui";

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end gap-4">
      {/* Message Content */}
      <div className="max-w-1/2">
        <Card className="p-4 bg-primary/5 border-primary/20 medical-border-glow">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {content}
          </p>
        </Card>
      </div>
    </div>
  );
}
