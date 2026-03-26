"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { DepartmentInfo, VisitDetail, completeVisit, transferVisit } from "@/lib/api";
import { deptLabel } from "../operations-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2 } from "lucide-react";

interface DepartmentDetailProps {
  visit: VisitDetail;
  departments: DepartmentInfo[];
  onVisitUpdated: () => void;
}

export function DepartmentDetail({ visit, departments, onVisitUpdated }: DepartmentDetailProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transferableDepts = departments.filter(
    (d) => d.is_open && d.name !== visit.current_department
  );

  const handleComplete = async () => {
    setIsCompleting(true);
    setError(null);
    try {
      await completeVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete visit");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    setError(null);
    try {
      await transferVisit(visit.id, transferTarget);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer visit");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Badge variant="outline" className="border-indigo-500/40 text-indigo-500 mb-2">
          In Department
        </Badge>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
      </div>

      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      {visit.intake_notes && (
        <div className="flex-1 min-h-0">
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Intake Notes
          </p>
          <ScrollArea className="max-h-32 rounded-lg border border-border/40 bg-background/40 p-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {visit.intake_notes}
            </p>
          </ScrollArea>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
          Department
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visit.routing_decision?.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {deptLabel(dept, departments)}
            </Badge>
          ))}
        </div>
        {visit.reviewed_by && (
          <p className="text-xs text-muted-foreground mt-2">
            Reviewed by: {visit.reviewed_by}
          </p>
        )}
      </div>

      {/* Transfer section */}
      {showTransfer && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
            Transfer to
          </p>
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border/40 bg-background/40">
            {transferableDepts.map((dept) => (
              <button
                key={dept.name}
                onClick={() => setTransferTarget(dept.name)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  transferTarget === dept.name
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border/40 pt-3 mt-auto space-y-2">
        {error && <p className="text-xs text-red-400 mb-1">{error}</p>}

        {showTransfer ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowTransfer(false); setTransferTarget(null); }}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={isTransferring || !transferTarget}
              size="sm"
              className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-xs"
            >
              <ArrowRightLeft className="w-3 h-3 mr-1.5" />
              {isTransferring ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransfer(true)}
              disabled={isCompleting || transferableDepts.length === 0}
              className="flex-1 text-xs border-violet-500/30 text-violet-400 hover:border-violet-500/60 hover:text-violet-300"
            >
              <ArrowRightLeft className="w-3 h-3 mr-1.5" />
              Transfer
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isCompleting}
              size="sm"
              className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {isCompleting ? "Completing..." : "Complete Visit"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
