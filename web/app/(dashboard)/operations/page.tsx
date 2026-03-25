// web/app/(dashboard)/operations/page.tsx
"use client";

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useHospitalCanvas } from "@/components/operations/use-hospital-canvas";
import { HospitalCanvas } from "@/components/operations/hospital-canvas";
import { KpiBar } from "@/components/operations/kpi-bar";
import { ReceptionDialog } from "@/components/operations/dialogs/reception-dialog";
import { DepartmentDialog } from "@/components/operations/dialogs/department-dialog";
import { transferVisit } from "@/lib/api";

export default function OperationsPage() {
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // Wire transfer handler at the page level so the hook can pass it into node data
  const handleTransfer = useCallback(async (visitId: number, targetDept: string) => {
    try {
      await transferVisit(visitId, targetDept);
    } catch (err) {
      console.error("Transfer failed:", err instanceof Error ? err.message : "Transfer failed");
    }
  }, []);

  const { nodes, edges, stats, departments, receptionVisits, departmentVisits, loading, error, refresh, resetPositions } =
    useHospitalCanvas(handleTransfer);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (nodeId === "reception") {
        setReceptionOpen(true);
      } else if (nodeId !== "discharge") {
        setSelectedDept(nodeId);
      }
    },
    []
  );

  const selectedDepartment = departments.find((d) => d.name === selectedDept) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#8b949e] font-mono text-sm">Loading hospital data...</div>
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
      <div className="flex items-center gap-2 border-b border-white/[0.06]">
        <KpiBar stats={stats} />
        <button
          onClick={resetPositions}
          className="flex items-center gap-1.5 px-3 py-1.5 mr-3 rounded-lg text-xs font-mono text-[#8b949e] hover:text-white border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] transition-all shrink-0"
          title="Reset node positions to default layout"
        >
          <RotateCcw size={12} />
          Reset Layout
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <HospitalCanvas
          initialNodes={nodes}
          initialEdges={edges}
          onNodeClick={handleNodeClick}
          onRefresh={refresh}
        />
      </div>

      <ReceptionDialog
        open={receptionOpen}
        onOpenChange={setReceptionOpen}
        visits={receptionVisits}
        onVisitUpdated={refresh}
      />

      <DepartmentDialog
        open={!!selectedDept}
        onOpenChange={(open) => !open && setSelectedDept(null)}
        department={selectedDepartment}
        visits={selectedDept ? (departmentVisits[selectedDept] ?? []) : []}
        onUpdated={refresh}
      />
    </div>
  );
}
