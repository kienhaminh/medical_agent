// web/components/operations/canvas/discharge-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface DischargeNodeData {
  count: number;
}

function DischargeNodeComponent({ data }: NodeProps) {
  const { count } = data as unknown as DischargeNodeData;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className="rounded-xl border px-5 py-3 min-w-[140px] backdrop-blur-sm text-center"
        style={{
          background: "rgba(16, 185, 129, 0.06)",
          borderColor: "rgba(16, 185, 129, 0.3)",
        }}
      >
        <div className="text-sm font-bold font-mono text-[#10b981]">
          DISCHARGE
        </div>
        <div className="text-xs font-mono text-[#8b949e] mt-1">
          {count} today
        </div>
      </div>
    </div>
  );
}

export const DischargeNode = memo(DischargeNodeComponent);
