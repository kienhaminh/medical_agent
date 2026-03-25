// web/components/operations/dialogs/reception-dialog.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VisitListItem } from "@/lib/api";
import { formatTimeAgo } from "../operations-constants";

interface ReceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visits: VisitListItem[];
  onVisitUpdated: () => void;
}

type Tab = "intake" | "routing" | "review";

const TABS: { id: Tab; label: string; statuses: string[] }[] = [
  { id: "intake", label: "Intake", statuses: ["intake", "triaged"] },
  { id: "routing", label: "Routing", statuses: ["auto_routed"] },
  { id: "review", label: "Review", statuses: ["pending_review", "routed"] },
];

export function ReceptionDialog({ open, onOpenChange, visits, onVisitUpdated }: ReceptionDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("intake");

  const filteredVisits = visits.filter((v) =>
    TABS.find((t) => t.id === activeTab)?.statuses.includes(v.status)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-[#161b22] border-[rgba(255,255,255,0.06)]">
        <DialogHeader>
          <DialogTitle className="text-[#00d9ff] font-mono">Reception</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[rgba(255,255,255,0.06)] pb-2">
          {TABS.map((tab) => {
            const count = visits.filter((v) => tab.statuses.includes(v.status)).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                  activeTab === tab.id
                    ? "bg-[rgba(0,217,255,0.1)] text-[#00d9ff]"
                    : "text-[#8b949e] hover:text-white"
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Visit List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {filteredVisits.length === 0 && (
            <p className="text-center text-[#8b949e] text-sm py-8">No patients in this stage</p>
          )}
          {filteredVisits.map((visit) => (
            <div
              key={visit.id}
              className="rounded-lg border px-3 py-2 cursor-pointer hover:border-[rgba(0,217,255,0.3)] transition-colors"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
                <span className="text-[10px] font-mono text-[#8b949e]">
                  {formatTimeAgo(visit.created_at)}
                </span>
              </div>
              {visit.chief_complaint && (
                <p className="text-xs text-[#8b949e] mt-1 line-clamp-1">{visit.chief_complaint}</p>
              )}
              <div className="text-[10px] font-mono text-[#6b7280] mt-1">
                {visit.visit_id} · {visit.status.replace("_", " ")}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
