// web/components/operations/canvas/flow-edge.tsx
"use client";

import { memo } from "react";
import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

function FlowEdgeComponent(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data } = props;
  const opacity = (data?.opacity as number) ?? 0.1;

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "rgba(0, 217, 255, 0.3)",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
        opacity,
      }}
    />
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
