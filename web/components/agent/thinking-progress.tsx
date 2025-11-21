"use client";

interface ThinkingProgressProps {
  reasoning: string;
}

export function ThinkingProgress({ reasoning }: ThinkingProgressProps) {
  return (
    <div className="p-3 border-b border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded bg-blue-500/10 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" />
            <path d="M16 15.5v.01" />
            <path d="M12 12v.01" />
            <path d="M11 17v.01" />
            <path d="M7 14v.01" />
          </svg>
        </div>
        <span className="font-mono text-xs font-medium text-muted-foreground">
          Thinking Process
        </span>
      </div>
      <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed pl-6">
        {reasoning}
      </div>
    </div>
  );
}
