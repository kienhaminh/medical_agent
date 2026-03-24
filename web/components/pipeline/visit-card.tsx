"use client";

import { cn } from "@/lib/utils";
import { VisitListItem } from "@/lib/api";
import { formatTimeAgo, getColumnForStatus } from "./pipeline-constants";

interface VisitCardProps {
  visit: VisitListItem;
  isSelected: boolean;
  onClick: () => void;
}

export function VisitCard({ visit, isSelected, onClick }: VisitCardProps) {
  const column = getColumnForStatus(visit.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg p-3 border transition-all",
        "bg-card/40 hover:bg-card/70",
        isSelected
          ? "border-cyan-500/60 bg-card/80 shadow-sm shadow-cyan-500/10"
          : "border-border/40 hover:border-border/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: column?.color }}
            />
            <span className="text-sm font-medium text-foreground truncate">
              {visit.patient_name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {visit.visit_id}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTimeAgo(visit.created_at)}
        </span>
      </div>
      {visit.chief_complaint && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
          {visit.chief_complaint}
        </p>
      )}
    </button>
  );
}
