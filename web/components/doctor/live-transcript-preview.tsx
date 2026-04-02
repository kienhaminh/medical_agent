"use client";

import { Loader2 } from "lucide-react";

interface LiveTranscriptPreviewProps {
  text: string;
  isRefining: boolean;
}

export function LiveTranscriptPreview({
  text,
  isRefining,
}: LiveTranscriptPreviewProps) {
  return (
    <div className="mx-3 mt-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {isRefining ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <Loader2 className="w-3 h-3 animate-spin" />
            Refining with AI...
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live transcript
          </span>
        )}
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
        {text || (
          <span className="text-muted-foreground italic">Listening...</span>
        )}
      </p>
    </div>
  );
}
