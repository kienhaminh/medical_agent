// web/app/(dashboard)/admin/page.tsx
"use client";

import { useAdminDashboard } from "./use-admin-dashboard";
import { AdminKpiBar } from "@/components/admin/admin-kpi-bar";
import { VisitPipelineKanban } from "@/components/admin/visit-pipeline-kanban";
import { PatientLocationTracker } from "@/components/admin/patient-location-tracker";

export default function AdminPage() {
  const {
    departments,
    visits,
    stats,
    visitsByStatus,
    loading,
    error,
    lastUpdated,
  } = useAdminDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Loading admin dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* KPI bar */}
      <div className="border-b border-border shrink-0">
        <AdminKpiBar stats={stats} lastUpdated={lastUpdated} />
      </div>

      {/* Patient Flow content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Visit Pipeline
          </h3>
          <VisitPipelineKanban visitsByStatus={visitsByStatus} />
        </div>

        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Patient Locations
          </h3>
          <PatientLocationTracker
            visits={visits}
            departments={departments}
          />
        </div>
      </div>
    </div>
  );
}
