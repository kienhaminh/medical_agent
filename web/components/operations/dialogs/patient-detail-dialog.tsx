// web/components/operations/dialogs/patient-detail-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getVisit, type VisitDetail } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";

interface PatientDetailDialogProps {
  visitId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientDetailDialog({ visitId, open, onOpenChange }: PatientDetailDialogProps) {
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visitId || !open) return;
    setLoading(true);
    getVisit(visitId)
      .then(setVisit)
      .finally(() => setLoading(false));
  }, [visitId, open]);

  if (!visit && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="text-white font-mono">
            {loading ? "Loading..." : visit?.patient_name}
          </DialogTitle>
        </DialogHeader>
        {visit && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#8b949e]">{visit.visit_id}</span>
              <span style={{ color: getWaitTimeColor(visit.created_at) }}>
                {formatTimeAgo(visit.created_at)}
              </span>
            </div>
            <div className="text-xs text-[#8b949e]">
              <span>{visit.patient_dob}</span> · <span className="capitalize">{visit.patient_gender}</span>
            </div>
            {visit.chief_complaint && (
              <div>
                <div className="text-[10px] font-mono text-[#6b7280] mb-1">Chief Complaint</div>
                <p className="text-sm text-[#c9d1d9]">{visit.chief_complaint}</p>
              </div>
            )}
            {visit.intake_notes && (
              <div>
                <div className="text-[10px] font-mono text-[#6b7280] mb-1">Intake Notes</div>
                <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap">{visit.intake_notes}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#8b949e]">Status:</span>
              <span className="text-white capitalize">{visit.status.replace("_", " ")}</span>
            </div>
            {visit.current_department && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#8b949e]">Department:</span>
                <span className="text-white capitalize">{visit.current_department.replace("_", " ")}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
