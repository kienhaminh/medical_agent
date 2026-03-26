// web/components/operations/department-grid.tsx
"use client";

import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DepartmentCard } from "./department-card";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onDeptClick: (deptName: string) => void;
}

const STATUS_PRIORITY: Record<string, number> = { CRITICAL: 0, BUSY: 1, OK: 2, IDLE: 3 };

export function DepartmentGrid({ departments, departmentVisits, onDeptClick }: DepartmentGridProps) {
  const sorted = [...departments].sort((a, b) => {
    // Closed departments always last
    if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
    const pa = STATUS_PRIORITY[a.status] ?? 4;
    const pb = STATUS_PRIORITY[b.status] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8b949e] font-mono text-sm">
        No departments configured
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {sorted.map((dept) => (
        <DepartmentCard
          key={dept.name}
          dept={dept}
          visits={departmentVisits[dept.name] ?? []}
          onClick={() => onDeptClick(dept.name)}
        />
      ))}
    </div>
  );
}
