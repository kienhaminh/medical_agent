// web/components/admin/visit-pipeline-kanban.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VisitListItem } from "@/lib/api";
import {
  formatTimeAgo,
  getWaitTimeColor,
} from "@/components/operations/operations-constants";

interface VisitPipelineKanbanProps {
  visitsByStatus: Record<string, VisitListItem[]>;
}

/** Column definitions for the Kanban pipeline. */
const PIPELINE_COLUMNS = [
  { status: "intake", label: "Intake", color: "#00d9ff" },
  { status: "auto_routed", label: "Routing", color: "#a855f7" },
  { status: "pending_review", label: "Needs Review", color: "#f59e0b" },
  { status: "routed", label: "Routed", color: "#14b8a6" },
  { status: "in_department", label: "In Department", color: "#6366f1" },
] as const;

/** Truncate text to a max length with ellipsis. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function VisitPipelineKanban({
  visitsByStatus,
}: VisitPipelineKanbanProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 min-h-[300px]">
      {PIPELINE_COLUMNS.map((col) => {
        const visits = visitsByStatus[col.status] ?? [];

        return (
          <div
            key={col.status}
            className="flex flex-col rounded-xl border min-w-[220px] w-[220px] shrink-0"
            style={{
              background: `${col.color}06`,
              borderColor: `${col.color}20`,
            }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <span
                className="text-xs font-bold font-mono"
                style={{ color: col.color }}
              >
                {col.label}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-mono px-1.5 py-0 h-5"
                style={{
                  color: col.color,
                  background: `${col.color}20`,
                  borderColor: `${col.color}30`,
                }}
              >
                {visits.length}
              </Badge>
            </div>

            {/* Visit cards */}
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="p-2 space-y-2">
                {visits.length === 0 && (
                  <div className="text-[10px] font-mono text-[#8b949e] text-center py-4">
                    No visits
                  </div>
                )}
                {visits.map((visit) => {
                  const waitColor = getWaitTimeColor(visit.created_at);
                  return (
                    <div
                      key={visit.visit_id}
                      className="rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05] transition-colors hover:bg-white/[0.05]"
                    >
                      {/* Patient name */}
                      <div className="text-[11px] font-bold font-mono text-[#c9d1d9] truncate">
                        {visit.patient_name}
                      </div>

                      {/* Visit ID */}
                      <div className="text-[10px] font-mono text-[#8b949e] mt-0.5">
                        {visit.visit_id}
                      </div>

                      {/* Complaint snippet */}
                      {visit.chief_complaint && (
                        <div className="text-[10px] font-mono text-[#8b949e] mt-1 leading-tight">
                          {truncate(visit.chief_complaint, 60)}
                        </div>
                      )}

                      {/* Footer: time + department */}
                      <div className="flex items-center justify-between mt-1.5">
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: waitColor }}
                        >
                          {formatTimeAgo(visit.created_at)}
                        </span>
                        {visit.current_department && (
                          <span className="text-[10px] font-mono text-[#6366f1] truncate ml-2">
                            {visit.current_department}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
