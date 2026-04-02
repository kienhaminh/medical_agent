// web/app/(dashboard)/admin/page.tsx
"use client";

import { useState } from "react";
import { useAdminDashboard } from "./use-admin-dashboard";
import { AdminKpiBar } from "@/components/admin/admin-kpi-bar";
import { DepartmentStatusGrid } from "@/components/admin/department-status-grid";
import { DepartmentDetailDialog } from "@/components/admin/department-detail-dialog";
import { VisitPipelineKanban } from "@/components/admin/visit-pipeline-kanban";
import { PatientLocationTracker } from "@/components/admin/patient-location-tracker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const {
    activeTab,
    setActiveTab,
    departments,
    visits,
    stats,
    visitsByStatus,
    departmentVisits,
    loading,
    error,
    lastUpdated,
  } = useAdminDashboard();

  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const selectedDepartment =
    departments.find((d) => d.name === selectedDept) ?? null;
  const selectedVisits = selectedDept
    ? departmentVisits[selectedDept] ?? []
    : [];

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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "overview" | "patient-flow")
        }
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="border-b border-border px-4 shrink-0">
          <TabsList className="bg-transparent h-9 gap-1">
            <TabsTrigger
              value="overview"
              className="text-xs font-mono data-[state=active]:bg-accent data-[state=active]:text-primary text-muted-foreground px-3 py-1.5 rounded-md"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="patient-flow"
              className="text-xs font-mono data-[state=active]:bg-accent data-[state=active]:text-primary text-muted-foreground px-3 py-1.5 rounded-md"
            >
              Patient Flow
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview tab: Department grid */}
        <TabsContent
          value="overview"
          className="flex-1 overflow-y-auto p-4 mt-0"
        >
          <DepartmentStatusGrid
            departments={departments}
            departmentVisits={departmentVisits}
            onDeptClick={(name) => setSelectedDept(name)}
          />

          <DepartmentDetailDialog
            open={selectedDept !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedDept(null);
            }}
            department={selectedDepartment}
            visits={selectedVisits}
          />
        </TabsContent>

        {/* Patient Flow tab: Kanban + Location tracker */}
        <TabsContent
          value="patient-flow"
          className="flex-1 overflow-y-auto p-4 space-y-6 mt-0"
        >
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
