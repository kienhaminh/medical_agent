// web/app/(dashboard)/operations/page.tsx
"use client";

import { useState } from "react";
import { useOperationsDashboard } from "@/components/operations/use-operations-dashboard";
import { KpiBar } from "@/components/operations/kpi-bar";
import { ReceptionBanner } from "@/components/operations/reception-banner";
import { DepartmentGrid } from "@/components/operations/department-grid";
import { ReceptionDialog } from "@/components/operations/dialogs/reception-dialog";

export default function OperationsPage() {
  const [receptionOpen, setReceptionOpen] = useState(false);

  const { departments, rooms, stats, receptionVisits, departmentVisits, loading, error, lastUpdated, refresh } =
    useOperationsDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground font-mono text-sm">Loading hospital data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400 font-mono text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* KPI bar */}
      <div className="border-b border-border">
        <KpiBar stats={stats} lastUpdated={lastUpdated} />
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Reception banner */}
        <ReceptionBanner
          visits={receptionVisits}
          onClick={() => setReceptionOpen(true)}
        />

        {/* Department grid */}
        <DepartmentGrid
          departments={departments}
          rooms={rooms}
          departmentVisits={departmentVisits}
        />
      </div>

      {/* Dialogs */}
      <ReceptionDialog
        open={receptionOpen}
        onOpenChange={setReceptionOpen}
        visits={receptionVisits}
        departments={departments}
        onVisitUpdated={refresh}
      />
    </div>
  );
}
