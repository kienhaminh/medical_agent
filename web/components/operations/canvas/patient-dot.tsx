// web/components/operations/canvas/patient-dot.tsx
"use client";

import { useState } from "react";
import type { VisitListItem } from "@/lib/api";
import { getWaitTimeColor } from "../operations-constants";
import { PatientPopover } from "./patient-popover";

interface PatientDotProps {
  visit: VisitListItem;
  index: number;
  /** Enable drag only for department patients (not reception) */
  draggable?: boolean;
}

export function PatientDot({ visit, index, draggable = false }: PatientDotProps) {
  const [showPopover, setShowPopover] = useState(false);
  const color = getWaitTimeColor(visit.created_at);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/visit-id", String(visit.id));
    e.dataTransfer.setData("application/source-dept", visit.current_department || "");
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="relative" style={{ marginLeft: index === 0 ? 0 : -4 }}>
      <button
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
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
          animation: `dotFadeIn 0.3s ease-out, pulse 2s ease-in-out 0.3s infinite`,
          animationDelay: `0s, ${index * 0.3}s`,
          cursor: draggable ? "grab" : "pointer",
        }}
        title={visit.patient_name}
      />
      {showPopover && (
        <PatientPopover visit={visit} onClose={() => setShowPopover(false)} />
      )}
    </div>
  );
}
