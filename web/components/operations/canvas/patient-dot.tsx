// web/components/operations/canvas/patient-dot.tsx
"use client";

import { useState } from "react";
import type { VisitListItem } from "@/lib/api";
import { getWaitTimeColor } from "../operations-constants";
import { PatientPopover } from "./patient-popover";

interface PatientDotProps {
  visit: VisitListItem;
  index: number;
}

export function PatientDot({ visit, index }: PatientDotProps) {
  const [showPopover, setShowPopover] = useState(false);
  const color = getWaitTimeColor(visit.created_at);

  return (
    <div className="relative" style={{ marginLeft: index === 0 ? 0 : -4 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowPopover(!showPopover);
        }}
        className="relative flex items-center justify-center rounded-full transition-transform hover:scale-125"
        style={{
          width: 14,
          height: 14,
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}80`,
          animation: "pulse 2s ease-in-out infinite",
          animationDelay: `${index * 0.3}s`,
        }}
        title={visit.patient_name}
      />
      {showPopover && (
        <PatientPopover visit={visit} onClose={() => setShowPopover(false)} />
      )}
    </div>
  );
}
