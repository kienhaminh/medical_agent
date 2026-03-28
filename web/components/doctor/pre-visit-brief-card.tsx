"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface PreVisitBriefCardProps {
  brief: string;
  loading: boolean;
}

export function PreVisitBriefCard({ brief, loading }: PreVisitBriefCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-3 mb-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-full mb-1" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-amber-800 dark:text-amber-300"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Pre-Visit Brief
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-amber-200 dark:border-amber-800 pt-2">
          {brief}
        </div>
      )}
    </div>
  );
}
