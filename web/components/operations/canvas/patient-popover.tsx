// web/components/operations/canvas/patient-popover.tsx
"use client";

import { useEffect, useRef } from "react";
import type { VisitListItem } from "@/lib/api";
import { formatTimeAgo, getWaitTimeColor } from "../operations-constants";

interface PatientPopoverProps {
  visit: VisitListItem;
  onClose: () => void;
  onViewDetails?: (visitId: number) => void;
}

export function PatientPopover({ visit, onClose, onViewDetails }: PatientPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const waitColor = getWaitTimeColor(visit.created_at);

  return (
    <div
      ref={ref}
      className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 rounded-lg border px-3 py-2 min-w-[200px] shadow-xl"
      style={{
        background: "#161b22",
        borderColor: "rgba(255,255,255,0.1)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-white">{visit.patient_name}</span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: waitColor }}
        />
      </div>
      <div className="text-[10px] font-mono text-[#8b949e] mb-1">{visit.visit_id}</div>
      {visit.chief_complaint && (
        <p className="text-xs text-[#c9d1d9] line-clamp-2 mb-1">{visit.chief_complaint}</p>
      )}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span style={{ color: waitColor }}>{formatTimeAgo(visit.created_at)}</span>
        <span className="text-[#8b949e] capitalize">{visit.status.replace("_", " ")}</span>
      </div>
      {onViewDetails && (
        <button
          onClick={() => { onViewDetails(visit.id); onClose(); }}
          className="text-[10px] font-mono text-[#00d9ff] hover:underline mt-1 block"
        >
          View Details →
        </button>
      )}
    </div>
  );
}
