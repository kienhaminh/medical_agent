"use client";

import { useState } from "react";
import { Brain, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { DiagnosisItem } from "@/lib/api";

interface DdxPanelProps {
  diagnoses: DiagnosisItem[];
  loading: boolean;
  onGenerate: () => void;
  disabled?: boolean;
  chiefComplaint?: string;
}

// Maps likelihood level to Tailwind color classes for the badge
const LIKELIHOOD_STYLE: Record<string, string> = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-slate-600 bg-slate-50 border-slate-200",
};

export function DdxPanel({ diagnoses, loading, onGenerate, disabled, chiefComplaint }: DdxPanelProps) {
  // Track which diagnosis row is expanded to show evidence/red flags
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="overflow-hidden">
      {/* Generate button */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        {chiefComplaint && (
          <span className="text-xs text-muted-foreground truncate">
            {chiefComplaint}
          </span>
        )}
        <button
          onClick={onGenerate}
          disabled={disabled || loading}
          className="text-xs px-2.5 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors ml-auto"
        >
          {loading ? "Generating..." : diagnoses.length ? "Refresh" : "Generate"}
        </button>
      </div>

      {/* Empty state — no diagnoses yet */}
      {diagnoses.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Click Generate to run differential diagnosis
        </p>
      )}

      {/* Skeleton loading placeholders */}
      {loading && (
        <div className="space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      )}

      {/* Diagnosis list — each row expands to show evidence and red flags */}
      <div className="divide-y divide-border">
        {diagnoses.map((dx, i) => (
          <div key={i}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{dx.name}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{dx.icd10}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LIKELIHOOD_STYLE[dx.likelihood] ?? LIKELIHOOD_STYLE.Low}`}
                >
                  {dx.likelihood}
                </span>
                {expanded === i
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>
            </button>

            {/* Expanded detail: evidence summary + red flag warnings */}
            {expanded === i && (
              <div className="px-3 pb-3 text-xs space-y-1.5 bg-muted/20">
                <p><span className="font-medium">Evidence:</span> {dx.evidence}</p>
                {dx.red_flags.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-red-600">{dx.red_flags.join(", ")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
