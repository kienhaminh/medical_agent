"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain,
  Terminal,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { ToolCallItem } from "./tool-call-item";
import { SubAgentConsultationItem } from "./sub-agent-consultation";
import { cn } from "@/lib/utils";
import type { AgentActivity, AgentProcessContainerProps, SubAgentConsultation } from "@/types/agent-ui";

// ---------------------------------------------------------------------------
// Activity labels
// ---------------------------------------------------------------------------

const ACTIVITY_LABELS: Record<AgentActivity, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  thinking:     { icon: Brain,    label: "Thinking"    },
  tool_calling: { icon: Terminal, label: "Using tools" },
  analyzing:    { icon: Sparkles, label: "Analyzing"   },
  searching:    { icon: Search,   label: "Searching"   },
  processing:   { icon: Sparkles, label: "Processing"  },
};

// ---------------------------------------------------------------------------
// Reasoning timeline item
// ---------------------------------------------------------------------------

function parseSubAgentConsultations(reasoning: string): {
  regularContent: string;
  consultations: SubAgentConsultation[];
} {
  const hasConsult =
    /CONSULT:/i.test(reasoning) || /REPORT FROM SPECIALIST/i.test(reasoning);
  if (!hasConsult) return { regularContent: reasoning, consultations: [] };

  const consultations: SubAgentConsultation[] = [];
  let regularContent = "";
  const parts = reasoning.split(
    /(REPORT FROM SPECIALIST \*\*\[[^\]]+\]\*\*:|\*\*\[[^\]]+\]\*\*:)/
  );

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const agentMatch = part.match(
      /REPORT FROM SPECIALIST \*\*\[([^\]]+)\]\*\*:|\*\*\[([^\]]+)\]\*\*:/
    );
    if (agentMatch && i + 1 < parts.length) {
      consultations.push({ agent: agentMatch[1] ?? agentMatch[2], response: parts[i + 1].trim() });
      i++;
    } else if (!agentMatch && !/CONSULT:/i.test(part)) {
      regularContent += part + "\n";
    }
  }
  return { regularContent: regularContent.trim(), consultations };
}

function ReasoningItem({
  reasoning,
  isLast,
  defaultOpen,
}: {
  reasoning: string;
  isLast: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { regularContent, consultations } = parseSubAgentConsultations(reasoning);

  return (
    <div className="flex gap-0">
      {/* Left: icon + connector */}
      <div className="flex flex-col items-center mr-3 shrink-0">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-muted/40 border border-border/40 text-muted-foreground/50">
          <Brain className="w-3 h-3" />
        </div>
        {!isLast && <div className="w-px flex-1 min-h-[12px] bg-border/40 mt-1" />}
      </div>

      {/* Right: content */}
      <div className={cn("flex-1 min-w-0", isLast ? "pb-1" : "pb-3")}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground/80 transition-colors"
        >
          <span>Reasoning</span>
          {open
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            {regularContent && (
              <div className="text-xs text-muted-foreground/80 font-mono leading-relaxed bg-muted/30 p-3 rounded-md border border-border/30 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {regularContent}
              </div>
            )}
            {consultations.map((c, i) => (
              <SubAgentConsultationItem key={i} consultation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading event item (active step)
// ---------------------------------------------------------------------------

function LoadingItem({ icon: Icon, label, details }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  details?: string;
}) {
  return (
    <div className="flex gap-0">
      <div className="flex flex-col items-center mr-3 shrink-0">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-primary/5 border border-primary/20 text-primary/60">
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-1 flex items-center gap-2">
        <Icon className="w-3 h-3 text-primary/50 shrink-0" />
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-primary/70">
          {label}
        </span>
        {details && (
          <span className="text-[11px] text-muted-foreground/40 truncate max-w-[200px]">
            · {details}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function AgentProcessContainer({
  reasoning,
  toolCalls,
  logs,
  isLatest,
  isLoading,
  currentActivity,
  activityDetails,
  tokenUsage,
}: AgentProcessContainerProps) {
  const [expanded, setExpanded] = useState(true);
  // Reasoning starts open; auto-collapses when first tool call arrives
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const prevLoadingRef = useRef(isLoading);
  const prevToolCountRef = useRef(toolCalls?.length ?? 0);

  // Auto-collapse outer container when streaming ends
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading && isLatest) {
      setExpanded(false);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, isLatest]);

  // Auto-collapse reasoning when first tool call arrives
  useEffect(() => {
    const count = toolCalls?.length ?? 0;
    if (prevToolCountRef.current === 0 && count > 0) {
      setReasoningOpen(false);
    }
    prevToolCountRef.current = count;
  }, [toolCalls?.length]);

  const hasReasoning = !!(reasoning?.trim() || logs?.length);
  const hasToolCalls = !!(toolCalls?.length);
  const hasContent = hasReasoning || hasToolCalls || !!tokenUsage;
  const showLoading = isLatest && isLoading;

  if (!hasContent && !showLoading) return null;

  const activity = currentActivity ? ACTIVITY_LABELS[currentActivity] : null;
  const ActivityIcon = activity?.icon ?? Brain;
  const activityLabel = activity?.label ?? "Working";

  // Build ordered event list
  // Reasoning always first, then tool calls in order
  const totalEvents =
    (hasReasoning ? 1 : 0) + (toolCalls?.length ?? 0) + (showLoading ? 1 : 0);

  let eventIndex = 0;

  const summaryLabel = hasToolCalls
    ? `Ran ${toolCalls!.length} tool${toolCalls!.length !== 1 ? "s" : ""}`
    : hasReasoning
    ? "Thinking"
    : "Working";

  return (
    <div className="mb-3">
      {/* Summary header */}
      <button
        onClick={hasContent ? () => setExpanded((v) => !v) : undefined}
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground/50 mb-3",
          hasContent && "hover:text-muted-foreground/75 transition-colors cursor-pointer"
        )}
      >
        {showLoading && !expanded ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
            <ActivityIcon className="w-3 h-3 text-primary/50" />
            <span className="font-mono tracking-wide text-primary/60 uppercase text-[10px]">
              {activityLabel}
            </span>
            {activityDetails && (
              <span className="text-muted-foreground/40 truncate max-w-[200px]">
                · {activityDetails}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-mono text-[11px]">{summaryLabel}</span>
            {tokenUsage && (
              <span className="text-muted-foreground/30 font-mono text-[10px]">
                · {tokenUsage.total_tokens.toLocaleString()} tokens
              </span>
            )}
            {hasContent && (
              expanded
                ? <ChevronUp className="w-3 h-3 text-muted-foreground/35" />
                : <ChevronDown className="w-3 h-3 text-muted-foreground/35" />
            )}
          </>
        )}
      </button>

      {/* Event timeline */}
      {expanded && (
        <div className="pl-1">
          {/* Reasoning-only: show content inline (no nested toggle, header is enough) */}
          {hasReasoning && !hasToolCalls && !showLoading && (() => {
            const { regularContent, consultations } = parseSubAgentConsultations(reasoning ?? "");
            return (
              <div className="space-y-2 mb-2">
                {regularContent && (
                  <div className="text-xs text-muted-foreground/80 font-mono leading-relaxed bg-muted/30 p-3 rounded-md border border-border/30 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {regularContent}
                  </div>
                )}
                {consultations.map((c, i) => (
                  <SubAgentConsultationItem key={i} consultation={c} />
                ))}
              </div>
            );
          })()}

          {/* Reasoning + tool calls: reasoning as a collapsible timeline item */}
          {hasReasoning && hasToolCalls && (() => {
            const isLast = ++eventIndex === totalEvents;
            return (
              <ReasoningItem
                reasoning={reasoning ?? ""}
                isLast={isLast}
                defaultOpen={reasoningOpen}
              />
            );
          })()}

          {/* Tool call events */}
          {toolCalls?.map((tc) => {
            const isLast = ++eventIndex === totalEvents;
            return <ToolCallItem key={tc.id} toolCall={tc} isLast={isLast} />;
          })}

          {/* Active loading event */}
          {showLoading && (
            <LoadingItem
              icon={ActivityIcon}
              label={activityLabel}
              details={activityDetails}
            />
          )}
        </div>
      )}
    </div>
  );
}
