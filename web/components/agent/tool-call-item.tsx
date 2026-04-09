"use client";

import { useState } from "react";
import {
  Brain,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scan,
  Terminal,
  UserCheck,
  UserPlus,
  FilePlus,
  GitCompare,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallItemProps } from "@/types/agent-ui";

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------

const TOOL_INFO: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  get_current_datetime:            { label: "Get current time",          icon: Clock },
  complete_triage:                 { label: "Complete triage",           icon: CheckSquare },
  save_clinical_note:              { label: "Save clinical note",        icon: FileText },
  update_visit_status:             { label: "Update visit status",       icon: RefreshCw },
  create_visit:                    { label: "Create visit",              icon: FilePlus },
  pre_visit_brief:                 { label: "Pre-visit brief",           icon: FileText },
  generate_differential_diagnosis: { label: "Generate differential Dx",  icon: Brain },
  create_order:                    { label: "Create order",              icon: ClipboardList },
  generate_shift_handoff:          { label: "Generate shift handoff",    icon: ArrowRightLeft },
  ask_user_input:                  { label: "Request user input",        icon: MessageSquare },
  set_itinerary:                   { label: "Set itinerary",             icon: Calendar },
  deposit_patient:                 { label: "Record patient data",       icon: UserPlus },
  check_patient:                   { label: "Check patient records",     icon: UserCheck },
  compare_patient:                 { label: "Compare patient data",      icon: GitCompare },
  register_patient:                { label: "Register patient",          icon: UserPlus },
  segment_patient_image:           { label: "Analyze MRI scan",          icon: Scan },
  medical_img_segmentation:        { label: "Analyze MRI scan",          icon: Scan },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && !Array.isArray(p)) return p;
  } catch {}
  return null;
}

const SKIP_RESULT_KEYS = new Set(["overlay_markdown", "predmask_url"]);

function ResultValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors truncate max-w-[240px] inline-block"
      >
        {value.split("/").pop() ?? value}
      </a>
    );
  }
  if (Array.isArray(value)) {
    return (
      <span className="text-foreground/70">
        {value.length ? value.map(String).join(", ") : "[]"}
      </span>
    );
  }
  const str = String(value);
  return (
    <span className="text-foreground/70 break-all">
      {str.length > 180 ? str.slice(0, 180) + "…" : str}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolCallItem({
  toolCall,
  isLast,
}: ToolCallItemProps & { isLast?: boolean }) {
  const [resultOpen, setResultOpen] = useState(false);

  const info = TOOL_INFO[toolCall.tool];
  const label = info?.label ?? toolCall.tool.replace(/_/g, " ");
  const Icon = info?.icon ?? Terminal;
  const isDone = !!toolCall.result;
  const parsed = toolCall.result ? tryParseJson(toolCall.result) : null;
  const isError = parsed?.status === "error";
  const resultEntries = parsed
    ? Object.entries(parsed).filter(([k]) => !SKIP_RESULT_KEYS.has(k))
    : null;

  // Scalar args shown as chips
  const argChips = Object.entries(toolCall.args)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
    .map(([k, v]) => ({ key: k, val: String(v) }))
    .filter(({ val }) => val.length <= 80);

  return (
    <div className="flex gap-0">
      {/* Left column: icon + connector line */}
      <div className="flex flex-col items-center mr-3 shrink-0">
        {/* Icon circle */}
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 border",
            isDone && !isError
              ? "bg-muted/40 border-border/40 text-muted-foreground/60"
              : isError
              ? "bg-destructive/10 border-destructive/30 text-destructive/70"
              : "bg-primary/5 border-primary/20 text-primary/60"
          )}
        >
          {!isDone ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isError ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <Icon className="w-3 h-3" />
          )}
        </div>
        {/* Vertical connector (hidden after last item) */}
        {!isLast && (
          <div className="w-px flex-1 min-h-[12px] bg-border/40 mt-1" />
        )}
      </div>

      {/* Right column: content */}
      <div className={cn("flex-1 min-w-0 pb-3", isLast && "pb-1")}>
        {/* Label */}
        <p className="text-sm text-foreground/70 leading-6">{label}</p>

        {/* Arg chips */}
        {argChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {argChips.map(({ key, val }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border border-border/30 text-[11px] text-muted-foreground/60 font-mono"
              >
                <span className="text-muted-foreground/40">{key}=</span>
                {val}
              </span>
            ))}
          </div>
        )}

        {/* Result toggle */}
        {isDone && (
          <div className="mt-1.5">
            <button
              onClick={() => setResultOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/45 hover:text-muted-foreground/70 transition-colors"
            >
              {resultOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className={cn("font-mono", isError && "text-destructive/60")}>
                {isError ? "error" : "result"}
              </span>
              {!resultOpen && resultEntries && (
                <span className="text-muted-foreground/30">
                  · {resultEntries.length} fields
                </span>
              )}
            </button>

            {resultOpen && (
              <div className="mt-1.5 rounded-md border border-border/25 bg-muted/20 overflow-hidden">
                {resultEntries ? (
                  <div className="divide-y divide-border/20">
                    {resultEntries.map(([k, v]) => (
                      <div
                        key={k}
                        className={cn(
                          "flex items-start gap-3 px-3 py-1.5 text-[11px]",
                          k === "status" && isError && "bg-destructive/5",
                          k === "status" && !isError && "bg-primary/5"
                        )}
                      >
                        <span className="font-mono text-muted-foreground/45 shrink-0 min-w-[90px] pt-px">
                          {k}
                        </span>
                        <span
                          className={cn(
                            "flex-1",
                            k === "status" && !isError && "text-primary font-medium",
                            k === "status" && isError && "text-destructive font-medium"
                          )}
                        >
                          <ResultValue value={v} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="p-2.5 text-[11px] font-mono text-muted-foreground/60 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                    {toolCall.result}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
