"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "@xyflow/react";
import { X } from "lucide-react";

interface CustomEdgeData extends Record<string, unknown> {
  onDelete?: (id: string, agentId: number, toolId: number) => void;
  agentId?: number;
  toolId?: number;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const edgeData = data as CustomEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Handle hover with delay to prevent flickering
  useEffect(() => {
    if (isHovered) {
      // Clear any pending leave timeout
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }
      // Show button after short delay
      hoverTimeoutRef.current = setTimeout(() => {
        setShowButton(true);
      }, 150);
    } else {
      // Clear any pending hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      // Hide button after short delay
      leaveTimeoutRef.current = setTimeout(() => {
        setShowButton(false);
      }, 100);
    }

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, [isHovered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const onEdgeClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (edgeData?.onDelete && edgeData?.agentId && edgeData?.toolId) {
        edgeData.onDelete(id, edgeData.agentId, edgeData.toolId);
      }
    },
    [id, edgeData]
  );

  return (
    <>
      {/* Visible edge path */}
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: "pointer" }}
      />

      <EdgeLabelRenderer>
        {showButton && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={onEdgeClick}
              className="flex items-center justify-center w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 animate-in fade-in zoom-in-75"
              title="Disconnect"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
