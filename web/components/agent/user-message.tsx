"use client";

import { User } from "lucide-react";
import { Card } from "@/components/ui/card";

interface UserMessageProps {
  content: string;
  timestamp: Date;
}

export function UserMessage({ content, timestamp }: UserMessageProps) {
  return (
    <div className="flex justify-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Message Content */}
      <div className="max-w-[80%] space-y-2">
        <Card className="p-4 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 medical-border-glow">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
            {content}
          </p>
        </Card>
        
        {/* Timestamp */}
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>You</span>
          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
          <span>{timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>

      {/* User Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-blue-500/30">
          <User className="w-5 h-5 text-blue-500" />
        </div>
      </div>
    </div>
  );
}
