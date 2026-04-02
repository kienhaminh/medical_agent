// web/components/operations/dialogs/reception-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DepartmentInfo, VisitDetail, VisitListItem } from "@/lib/api";
import { getVisit } from "@/lib/api";
import { formatTimeAgo } from "../operations-constants";
import { IntakeDetail } from "./intake-detail";
import { ReviewDetail } from "./review-detail";

interface ReceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visits: VisitListItem[];
  departments: DepartmentInfo[];
  onVisitUpdated: () => void;
}

type Tab = "intake" | "routing" | "review";

const TABS: { id: Tab; label: string; statuses: string[] }[] = [
  { id: "intake", label: "Intake", statuses: ["intake", "triaged"] },
  { id: "routing", label: "Routing", statuses: ["auto_routed"] },
  { id: "review", label: "Review", statuses: ["pending_review", "routed"] },
];

export function ReceptionDialog({ open, onOpenChange, visits, departments, onVisitUpdated }: ReceptionDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("intake");
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [visitLoadError, setVisitLoadError] = useState<string | null>(null);

  // Auto-switch to Review tab when dialog opens and review items are pending
  useEffect(() => {
    if (open) {
      const hasReview = visits.some((v) => ["pending_review", "routed"].includes(v.status));
      if (hasReview) setActiveTab("review");
    }
  }, [open]);

  const filteredVisits = visits.filter((v) =>
    TABS.find((t) => t.id === activeTab)?.statuses.includes(v.status)
  );

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

  const handleBack = () => {
    setSelectedVisit(null);
  };

  const handleVisitUpdated = () => {
    setSelectedVisit(null);
    onVisitUpdated();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedVisit(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-primary font-mono flex items-center gap-2">
            {selectedVisit && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {selectedVisit ? selectedVisit.patient_name : "Reception"}
          </DialogTitle>
        </DialogHeader>

        {selectedVisit ? (
          <div className="flex-1 overflow-y-auto">
            {["intake", "triaged"].includes(selectedVisit.status) ? (
              <IntakeDetail visit={selectedVisit} />
            ) : (
              <ReviewDetail visit={selectedVisit} departments={departments} onVisitUpdated={handleVisitUpdated} />
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border pb-2">
              {TABS.map((tab) => {
                const count = visits.filter((v) => tab.statuses.includes(v.status)).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Visit List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {visitLoadError && (
                <p className="text-xs text-red-400 px-1">{visitLoadError}</p>
              )}
              {filteredVisits.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No patients in this stage</p>
              )}
              {filteredVisits.map((visit) => (
                <button
                  key={visit.id}
                  onClick={() => handleVisitClick(visit)}
                  disabled={loadingVisit}
                  className="w-full text-left rounded-lg border border-border bg-muted/20 px-3 py-2 cursor-pointer hover:border-primary/30 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{visit.patient_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatTimeAgo(visit.created_at)}
                    </span>
                  </div>
                  {visit.chief_complaint && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{visit.chief_complaint}</p>
                  )}
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">
                    {visit.visit_id} · {visit.status.replaceAll("_", " ")}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
