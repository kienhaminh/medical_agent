// web/components/operations/canvas/reception-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { VisitListItem } from "@/lib/api";
import { QueueTail } from "./queue-tail";

interface ReceptionNodeData {
  visits: VisitListItem[];
}

function ReceptionNodeComponent({ data }: NodeProps) {
  const { visits } = data as unknown as ReceptionNodeData;

  const intakeCount = visits.filter((v) => v.status === "intake" || v.status === "triaged").length;
  const routingCount = visits.filter((v) => v.status === "auto_routed").length;
  const reviewCount = visits.filter((v) => v.status === "pending_review" || v.status === "routed").length;

  return (
    <div className="relative">
      <QueueTail visits={visits} />
      <div
        className="rounded-xl border px-6 py-4 min-w-[240px] backdrop-blur-sm"
        style={{
          background: "rgba(0, 217, 255, 0.06)",
          borderColor: "rgba(0, 217, 255, 0.4)",
          boxShadow: "0 0 15px rgba(0, 217, 255, 0.1)",
        }}
      >
        <div className="text-sm font-bold font-mono text-[#00d9ff] mb-2">
          RECEPTION
        </div>
        <div className="flex gap-3 text-[11px] font-mono">
          {intakeCount > 0 && (
            <span className="text-[#00d9ff]">{intakeCount} intake</span>
          )}
          {routingCount > 0 && (
            <span className="text-[#a78bfa]">{routingCount} routing</span>
          )}
          {reviewCount > 0 && (
            <span className="text-[#f59e0b]">{reviewCount} review</span>
          )}
          {visits.length === 0 && (
            <span className="text-[#8b949e]">No patients</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

export const ReceptionNode = memo(ReceptionNodeComponent);
