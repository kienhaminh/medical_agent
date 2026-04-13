// web/components/operations/department-grid.tsx
"use client";

import { useState } from "react";
import type { DepartmentInfo, VisitListItem, RoomInfo } from "@/lib/api";
import { DepartmentCard } from "./department-card";
import { DepartmentDialog } from "./dialogs/department-dialog";

interface DepartmentGridProps {
  departments: DepartmentInfo[];
  rooms: RoomInfo[];
  departmentVisits: Record<string, VisitListItem[]>;
  onUpdated: () => void;
}

const STATUS_PRIORITY: Record<string, number> = { CRITICAL: 0, BUSY: 1, OK: 2, IDLE: 3 };

export function DepartmentGrid({ departments, rooms, departmentVisits, onUpdated }: DepartmentGridProps) {
  const [selectedDept, setSelectedDept] = useState<DepartmentInfo | null>(null);

  const sorted = [...departments].sort((a, b) => {
    if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
    const pa = STATUS_PRIORITY[a.status] ?? 4;
    const pb = STATUS_PRIORITY[b.status] ?? 4;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground font-mono text-sm">
        No departments configured
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-2 grid-cols-4">
        {sorted.map((dept) => (
          <DepartmentCard
            key={dept.name}
            dept={dept}
            rooms={rooms.filter((r) => r.department_name === dept.name)}
            onClick={() => setSelectedDept(dept)}
          />
        ))}
      </div>

      <DepartmentDialog
        open={selectedDept !== null}
        onOpenChange={(open) => { if (!open) setSelectedDept(null); }}
        department={selectedDept}
        departments={departments}
        visits={selectedDept ? (departmentVisits[selectedDept.name] ?? []) : []}
        onUpdated={onUpdated}
      />
    </>
  );
}
