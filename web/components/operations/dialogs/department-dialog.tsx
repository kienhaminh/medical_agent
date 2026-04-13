// web/components/operations/dialogs/department-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DepartmentInfo, VisitDetail, VisitListItem } from "@/lib/api";
import { getVisit, updateDepartment } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "../operations-constants";
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [visitLoadError, setVisitLoadError] = useState<string | null>(null);

  useEffect(() => {
    setCapacity(department?.capacity ?? 3);
    setVisitLoadError(null);
  }, [department?.name]);

  if (!department) return null;

  const handleVisitClick = async (visit: VisitListItem) => {
    setLoadingVisit(true);
    setVisitLoadError(null);
    try {
      const detail = await getVisit(visit.id);
      setSelectedVisit(detail);
    } catch (err) {
      setVisitLoadError(err instanceof Error ? err.message : "Failed to load visit");
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
    setSaveError(null);
    try {
      await updateDepartment(department.name, { is_open: !department.is_open });
      onUpdated();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update department");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCapacity = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateDepartment(department.name, { capacity });
      onUpdated();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save capacity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[420px] flex flex-col gap-0 p-0 bg-card border-border">
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="font-mono flex items-center gap-2 text-foreground text-sm">
            {selectedVisit && (
              <button
                onClick={() => setSelectedVisit(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            {selectedVisit ? selectedVisit.patient_name : department.label}
          </SheetTitle>
        </SheetHeader>

        {selectedVisit ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <DepartmentDetail visit={selectedVisit} departments={departments} onVisitUpdated={handleVisitUpdated} />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Settings */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-xs font-mono text-muted-foreground">Capacity:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-14 rounded bg-muted/50 border border-border px-2 py-1 text-xs font-mono text-foreground"
                />
                <button
                  onClick={handleSaveCapacity}
                  disabled={saving || capacity === department.capacity}
                  className="text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              <button
                onClick={handleToggleOpen}
                disabled={saving}
                className={`text-xs font-mono px-2 py-1 rounded ${
                  department.is_open
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {department.is_open ? "Close Dept" : "Open Dept"}
              </button>
            </div>
            {saveError && (
              <p className="text-xs text-red-400 px-5 pt-2">{saveError}</p>
            )}

            {/* Patient Queue */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              <div className="text-xs font-mono text-muted-foreground mb-2">
                Patient Queue ({visits.length})
              </div>
              {visitLoadError && (
                <p className="text-xs text-red-400">{visitLoadError}</p>
              )}
              {visits.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No patients</p>
              )}
              {visits.map((visit) => {
                const minutes = Math.floor((Date.now() - new Date(visit.created_at).getTime()) / 60000);
                const waitClass = minutes < 10 ? "text-emerald-600" : minutes < 30 ? "text-amber-500" : "text-red-500";
                const dotClass  = minutes < 10 ? "bg-emerald-600"  : minutes < 30 ? "bg-amber-500"  : "bg-red-500";
                return (
                  <button
                    key={visit.id}
                    onClick={() => handleVisitClick(visit)}
                    disabled={loadingVisit}
                    className="w-full text-left rounded-lg border border-border bg-muted/40 px-3 py-2 hover:bg-muted/70 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full", dotClass)} />
                        <span className="text-sm font-medium text-foreground">{visit.patient_name}</span>
                      </div>
                      <span className={cn("text-[10px] font-mono", waitClass)}>
                        {formatTimeAgo(visit.created_at)}
                      </span>
                    </div>
                    {visit.chief_complaint && (
                      <p className="text-xs text-muted-foreground mt-1 ml-3.5 truncate">{visit.chief_complaint}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
