"use client";

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
    <div className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-amber-50/50 dark:bg-amber-950/10">
      {brief}
    </div>
  );
}
