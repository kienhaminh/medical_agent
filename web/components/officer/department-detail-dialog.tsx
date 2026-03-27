// web/components/officer/department-detail-dialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import {
  formatTimeAgo,
  DEPARTMENT_STATUS_COLORS,
  getWaitTimeColor,
} from "@/components/operations/operations-constants";

interface DepartmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentInfo | null;
  visits: VisitListItem[];
}

export function DepartmentDetailDialog({
  open,
  onOpenChange,
  department,
  visits,
}: DepartmentDetailDialogProps) {
  if (!department) return null;

  const statusColor =
    DEPARTMENT_STATUS_COLORS[
      department.status as keyof typeof DEPARTMENT_STATUS_COLORS
    ] || "#6b7280";

  const utilization =
    department.capacity > 0
      ? Math.round(
          (department.current_patient_count / department.capacity) * 100
        )
      : 0;

  const sortedVisits = [...visits].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d1117] border-white/10 text-[#c9d1d9] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-mono">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ background: statusColor }}
            />
            <span style={{ color: statusColor }}>
              {department.label}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] font-mono px-1.5 py-0.5 ml-auto"
              style={{
                color: statusColor,
                background: `${statusColor}20`,
                borderColor: `${statusColor}30`,
              }}
            >
              {department.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Capacity section */}
        <div className="mt-2">
          <div className="flex justify-between text-xs font-mono text-[#8b949e] mb-1.5">
            <span>
              Capacity: {department.current_patient_count}/
              {department.capacity}
            </span>
            <span>{utilization}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(utilization, 100)}%`,
                background: statusColor,
              }}
            />
          </div>
        </div>

        {/* Patient list */}
        <div className="mt-4">
          <h4 className="text-xs font-mono text-[#8b949e] mb-2 uppercase tracking-wider">
            Patients ({sortedVisits.length})
          </h4>

          {sortedVisits.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[#8b949e] font-mono text-sm">
              No patients in this department
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-2">
                {sortedVisits.map((visit) => {
                  const waitColor = getWaitTimeColor(visit.created_at);
                  return (
                    <div
                      key={visit.visit_id}
                      className="rounded-lg px-3 py-2 bg-white/[0.03] border border-white/[0.05]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono text-[#c9d1d9] truncate">
                          {visit.patient_name}
                        </span>
                        <span
                          className="text-[10px] font-mono shrink-0 ml-2"
                          style={{ color: waitColor }}
                        >
                          {formatTimeAgo(visit.created_at)}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8b949e] mt-0.5">
                        {visit.visit_id}
                      </div>
                      {visit.chief_complaint && (
                        <div className="text-[10px] font-mono text-[#8b949e] mt-1 truncate">
                          {visit.chief_complaint}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
