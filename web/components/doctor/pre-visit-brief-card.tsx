"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PreVisitBriefCardProps {
  brief: string;
  loading: boolean;
}

export function PreVisitBriefCard({ brief, loading }: PreVisitBriefCardProps) {
  if (loading) {
    return (
      <div className="p-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-full mb-1" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (!brief) return null;

  return (
    <div className="px-3 py-2 text-xs leading-relaxed bg-amber-50/50 dark:bg-amber-950/10 prose prose-xs dark:prose-invert max-w-none prose-headings:text-xs prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief}</ReactMarkdown>
    </div>
  );
}
