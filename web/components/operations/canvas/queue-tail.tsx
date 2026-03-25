// web/components/operations/canvas/queue-tail.tsx
"use client";

import type { VisitListItem } from "@/lib/api";
import { PatientDot } from "./patient-dot";

interface QueueTailProps {
  visits: VisitListItem[];
}

const MAX_VISIBLE = 6;

export function QueueTail({ visits }: QueueTailProps) {
  if (visits.length === 0) return null;

  const sorted = [...visits].sort(
    (a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0)
  );
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-0.5 absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2">
      <div className="flex items-center flex-row-reverse gap-0.5">
        {visible.map((visit, i) => (
          <PatientDot key={visit.id} visit={visit} index={i} />
        ))}
      </div>
      {overflow > 0 && (
        <span
          className="text-xs font-mono ml-1 rounded-full px-1.5 py-0.5"
          style={{ color: "#8b949e", background: "rgba(255,255,255,0.05)" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
