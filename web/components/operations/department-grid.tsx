// web/components/operations/department-grid.tsx
"use client";

import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DepartmentCard } from "./department-card";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onDeptClick: (deptName: string) => void;
}

export function DepartmentGrid({ departments, departmentVisits, onDeptClick }: DepartmentGridProps) {
  const sorted = [...departments].sort((a, b) => a.label.localeCompare(b.label));

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
