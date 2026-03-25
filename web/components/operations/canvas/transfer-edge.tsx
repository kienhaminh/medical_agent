// web/components/operations/canvas/transfer-edge.tsx
"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function TransferEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY } = props;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    borderRadius: 16,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "#f59e0b",
        strokeWidth: 2,
        animation: "edgeGlow 1s ease-out forwards",
      }}
    />
  );
}

export const TransferEdge = memo(TransferEdgeComponent);
