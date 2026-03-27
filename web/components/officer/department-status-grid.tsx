// web/components/officer/department-status-grid.tsx
"use client";

import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "@/components/operations/operations-constants";

interface DepartmentStatusGridProps {
  departments: DepartmentInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onDeptClick: (deptName: string) => void;
}

/** Sort priority: CRITICAL first, then BUSY, OK, IDLE. Closed always last. */
const STATUS_PRIORITY: Record<string, number> = {
  CRITICAL: 0,
  BUSY: 1,
  OK: 2,
  IDLE: 3,
};

export function DepartmentStatusGrid({
  departments,
  departmentVisits,
  onDeptClick,
}: DepartmentStatusGridProps) {
  const sorted = [...departments].sort((a, b) => {
    if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
    const pa = STATUS_PRIORITY[a.status] ?? 4;
    const pb = STATUS_PRIORITY[b.status] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#8b949e] font-mono text-sm gap-2">
        <Building2 size={24} className="opacity-40" />
        No departments configured
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {sorted.map((dept) => {
        const statusColor =
          DEPARTMENT_STATUS_COLORS[
            dept.status as keyof typeof DEPARTMENT_STATUS_COLORS
          ] || "#6b7280";
        const visits = departmentVisits[dept.name] ?? [];
        const utilization =
          dept.capacity > 0
            ? Math.round(
                (dept.current_patient_count / dept.capacity) * 100
              )
            : 0;
        const isClosed = !dept.is_open;
        const isCritical = dept.status === "CRITICAL";

        return (
          <button
            key={dept.name}
            onClick={() => onDeptClick(dept.name)}
            className={[
              "w-full text-left rounded-xl border px-4 py-3",
              "transition-all hover:brightness-110 focus:outline-none",
              isCritical ? "animate-pulse" : "",
            ].join(" ")}
            style={{
              background: isClosed
                ? "rgba(255,255,255,0.02)"
                : `${statusColor}08`,
              borderColor: isClosed
                ? "rgba(255,255,255,0.08)"
                : `${statusColor}40`,
              boxShadow: isCritical
                ? `0 0 20px ${statusColor}30`
                : "none",
              opacity: isClosed ? 0.55 : 1,
            }}
          >
            {/* Header: colored dot + name + status badge */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background: isClosed ? "#6b7280" : statusColor,
                  }}
                />
                <span
                  className="text-sm font-bold font-mono truncate"
                  style={{ color: isClosed ? "#8b949e" : statusColor }}
                >
                  {dept.label}
                </span>
              </div>

              {isClosed ? (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0.5 border-red-400/20 bg-red-400/10 text-red-400 shrink-0"
                >
                  CLOSED
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0.5 shrink-0"
                  style={{
                    color: statusColor,
                    background: `${statusColor}20`,
                    borderColor: `${statusColor}30`,
                  }}
                >
                  {dept.status}
                </Badge>
              )}
            </div>

            {/* Capacity bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] font-mono text-[#8b949e] mb-1">
                <span>
                  {dept.current_patient_count}/{dept.capacity} beds
                </span>
                <span>{utilization}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(utilization, 100)}%`,
                    background: isClosed ? "#6b7280" : statusColor,
                  }}
                />
              </div>
            </div>

            {/* Queue indicator */}
            {dept.queue_length > 0 && (
              <div className="text-[10px] font-mono text-[#f59e0b] mt-1">
                {dept.queue_length} in queue
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
