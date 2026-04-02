// web/components/admin/patient-location-tracker.tsx
"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VisitListItem, DepartmentInfo } from "@/lib/api";
import {
  formatTimeAgo,
  deptLabel,
  getWaitTimeColor,
} from "@/components/operations/operations-constants";

interface PatientLocationTrackerProps {
  visits: VisitListItem[];
  departments: DepartmentInfo[];
}

type SortKey =
  | "patient_name"
  | "visit_id"
  | "status"
  | "department"
  | "complaint"
  | "time";
type SortDir = "asc" | "desc";

/** Status-to-color mapping for badges. */
const STATUS_BADGE_COLORS: Record<string, string> = {
  intake: "hsl(var(--primary))",
  auto_routed: "#a855f7",
  pending_review: "#f59e0b",
  routed: "#14b8a6",
  in_department: "#6d7a8c",
};

export function PatientLocationTracker({
  visits,
  departments,
}: PatientLocationTrackerProps) {
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filter out completed visits
  const activeVisits = useMemo(
    () => visits.filter((v) => v.status !== "completed"),
    [visits]
  );

  // Sort visits by the selected column
  const sorted = useMemo(() => {
    return [...activeVisits].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "patient_name":
          return dir * a.patient_name.localeCompare(b.patient_name);
        case "visit_id":
          return dir * a.visit_id.localeCompare(b.visit_id);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "department":
          return (
            dir *
            (a.current_department ?? "").localeCompare(
              b.current_department ?? ""
            )
          );
        case "complaint":
          return (
            dir *
            (a.chief_complaint ?? "").localeCompare(
              b.chief_complaint ?? ""
            )
          );
        case "time":
          return (
            dir *
            (new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime())
          );
        default:
          return 0;
      }
    });
  }, [activeVisits, sortKey, sortDir]);

  /** Toggle sort on header click. */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /** Render a sortable column header. */
  function SortableHeader({
    label,
    columnKey,
    className,
  }: {
    label: string;
    columnKey: SortKey;
    className?: string;
  }) {
    const isActive = sortKey === columnKey;
    const arrow = isActive ? (sortDir === "asc" ? " ^" : " v") : "";
    return (
      <th
        className={[
          "text-left text-[10px] font-mono uppercase tracking-wider px-3 py-2 cursor-pointer select-none transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => handleSort(columnKey)}
      >
        {label}
        {arrow}
      </th>
    );
  }

  if (activeVisits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground font-mono text-sm gap-2">
        <MapPin size={24} className="opacity-40" />
        No active patients
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left">
        <thead className="bg-muted/30">
          <tr>
            <SortableHeader label="Patient" columnKey="patient_name" />
            <SortableHeader label="Visit ID" columnKey="visit_id" />
            <SortableHeader label="Status" columnKey="status" />
            <SortableHeader label="Department" columnKey="department" />
            <SortableHeader label="Complaint" columnKey="complaint" />
            <SortableHeader label="Time" columnKey="time" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((visit) => {
            const statusColor =
              STATUS_BADGE_COLORS[visit.status] ?? "#6b7280";
            const waitColor = getWaitTimeColor(visit.created_at);
            const dept = visit.current_department
              ? deptLabel(visit.current_department, departments)
              : "\u2014";

            return (
              <tr
                key={visit.visit_id}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-2 text-[11px] font-bold font-mono text-foreground truncate max-w-[140px]">
                  {visit.patient_name}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">
                  {visit.visit_id}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono px-1.5 py-0.5"
                    style={{
                      color: statusColor,
                      background: `${statusColor}20`,
                      borderColor: `${statusColor}30`,
                    }}
                  >
                    {visit.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-[11px] font-mono text-muted-foreground">
                  {dept}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                  {visit.chief_complaint ?? "\u2014"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: waitColor }}
                  >
                    {formatTimeAgo(visit.created_at)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
