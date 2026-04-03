"use client";

import type { UserMessageProps } from "@/types/agent-ui";

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end px-1">
      <div className="max-w-[72%]">
        <div className="px-4 py-2.5 rounded-2xl rounded-br-md bg-muted text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    </div>
  );
}
