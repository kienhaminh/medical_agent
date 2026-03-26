// web/components/operations/dialogs/department-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DepartmentInfo, VisitDetail, VisitListItem } from "@/lib/api";
import { getVisit, updateDepartment } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";
import { DepartmentDetail } from "./department-detail";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentInfo | null;
  departments: DepartmentInfo[];
  visits: VisitListItem[];
  onUpdated: () => void;
}

export function DepartmentDialog({ open, onOpenChange, department, departments, visits, onUpdated }: DepartmentDialogProps) {
  const [capacity, setCapacity] = useState(department?.capacity ?? 3);
  const [saving, setSaving] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [loadingVisit, setLoadingVisit] = useState(false);

  // Sync capacity when department changes (e.g. user opens a different dept)
  useEffect(() => {
    setCapacity(department?.capacity ?? 3);
  }, [department?.name]);

  if (!department) return null;

  const handleVisitClick = async (visit: VisitListItem) => {
    setLoadingVisit(true);
    try {
      const detail = await getVisit(visit.id);
      setSelectedVisit(detail);
    } catch (err) {
      console.error("Failed to load visit detail:", err);
    } finally {
      setLoadingVisit(false);
    }
  };

  const handleVisitUpdated = () => {
    setSelectedVisit(null);
    onUpdated();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedVisit(null);
    onOpenChange(nextOpen);
  };

  const handleToggleOpen = async () => {
    setSaving(true);
    try {
      await updateDepartment(department.name, { is_open: !department.is_open });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCapacity = async () => {
    setSaving(true);
    try {
      await updateDepartment(department.name, { capacity });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2" style={{ color: department.color }}>
            {selectedVisit && (
              <button
                onClick={() => setSelectedVisit(null)}
                className="text-[#8b949e] hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {selectedVisit ? selectedVisit.patient_name : department.label}
          </DialogTitle>
        </DialogHeader>

        {selectedVisit ? (
          <div className="flex-1 overflow-y-auto">
            <DepartmentDetail visit={selectedVisit} departments={departments} onVisitUpdated={handleVisitUpdated} />
          </div>
        ) : (
          <>
            {/* Settings */}
            <div className="flex items-center gap-4 py-2 border-b border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-[#8b949e]">Capacity:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-14 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] px-2 py-1 text-xs font-mono text-white"
                />
                <button
                  onClick={handleSaveCapacity}
                  disabled={saving || capacity === department.capacity}
                  className="text-xs font-mono px-2 py-1 rounded bg-[rgba(0,217,255,0.1)] text-[#00d9ff] hover:bg-[rgba(0,217,255,0.2)] disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              <button
                onClick={handleToggleOpen}
                disabled={saving}
                className={`text-xs font-mono px-2 py-1 rounded ${
                  department.is_open
                    ? "bg-[rgba(239,68,68,0.1)] text-red-400 hover:bg-[rgba(239,68,68,0.2)]"
                    : "bg-[rgba(16,185,129,0.1)] text-emerald-400 hover:bg-[rgba(16,185,129,0.2)]"
                }`}
              >
                {department.is_open ? "Close Dept" : "Open Dept"}
              </button>
            </div>

            {/* Patient Queue */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              <div className="text-xs font-mono text-[#8b949e] mb-1">
                Patient Queue ({visits.length})
              </div>
              {visits.length === 0 && (
                <p className="text-center text-[#8b949e] text-sm py-6">No patients</p>
              )}
              {visits.map((visit) => {
                const waitColor = getWaitTimeColor(visit.created_at);
                return (
                  <button
                    key={visit.id}
                    onClick={() => handleVisitClick(visit)}
                    disabled={loadingVisit}
                    className="w-full text-left rounded-lg border px-3 py-2 hover:border-[rgba(255,255,255,0.15)] transition-colors disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: waitColor }} />
                        <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: waitColor }}>
                        {formatTimeAgo(visit.created_at)}
                      </span>
                    </div>
                    {visit.chief_complaint && (
                      <p className="text-xs text-[#8b949e] mt-1 line-clamp-1 ml-4">{visit.chief_complaint}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
