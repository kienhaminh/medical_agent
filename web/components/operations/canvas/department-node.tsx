// web/components/operations/canvas/department-node.tsx
"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "../operations-constants";
import { QueueTail } from "./queue-tail";

interface DepartmentNodeData {
  department: DepartmentInfo;
  visits: VisitListItem[];
  onTransfer?: (visitId: number, targetDept: string) => void;
  onToggleOpen?: (deptName: string) => void;
  onSetCapacity?: (deptName: string) => void;
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department, visits, onTransfer, onToggleOpen, onSetCapacity } = data as unknown as DepartmentNodeData;
  const statusColor = DEPARTMENT_STATUS_COLORS[department.status as keyof typeof DEPARTMENT_STATUS_COLORS] || "#6b7280";
  const isCritical = department.status === "CRITICAL";
  const utilization = department.capacity > 0
    ? Math.round((department.current_patient_count / department.capacity) * 100)
    : 0;

  // Capacity ring: circumference of r=20 circle = 125.66
  const circumference = 125.66;
  const filled = (utilization / 100) * circumference;

  // Drag-over state for drop highlighting
  const [dragOver, setDragOver] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (department.is_open) {
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    }
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const visitId = Number(e.dataTransfer.getData("application/visit-id"));
    const sourceDept = e.dataTransfer.getData("application/source-dept");
    if (visitId && onTransfer && sourceDept !== department.name) {
      onTransfer(visitId, department.name);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      <QueueTail visits={visits} draggable />
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className="rounded-xl border px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all"
        style={{
          background: `${statusColor}08`,
          borderColor: dragOver ? statusColor : `${statusColor}40`,
          boxShadow: dragOver
            ? `0 0 20px ${statusColor}50`
            : isCritical
              ? `0 0 20px ${statusColor}30`
              : "none",
          animation: isCritical ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-bold font-mono" style={{ color: statusColor }}>
            {department.label}
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{
              color: statusColor,
              background: `${statusColor}20`,
            }}
          >
            {department.status}
          </span>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-3">
          <svg width="44" height="44" className="flex-shrink-0">
            <circle
              cx="22" cy="22" r="20"
              fill="none"
              stroke={`${statusColor}20`}
              strokeWidth="3"
            />
            <circle
              cx="22" cy="22" r="20"
              fill="none"
              stroke={statusColor}
              strokeWidth="3"
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
            <text
              x="22" y="22"
              textAnchor="middle"
              dominantBaseline="central"
              fill={statusColor}
              fontSize="10"
              fontFamily="monospace"
            >
              {utilization}%
            </text>
          </svg>
          <div>
            <div className="text-xs font-mono" style={{ color: "#8b949e" }}>
              {department.current_patient_count}/{department.capacity} beds
            </div>
            {!department.is_open && (
              <div className="text-[10px] font-mono text-red-400 mt-0.5">CLOSED</div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 rounded-lg border shadow-xl py-1 min-w-[150px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: "#161b22",
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-[#8b949e] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
            onClick={() => {
              onToggleOpen?.(department.name);
              setContextMenu(null);
            }}
          >
            {department.is_open ? "Close Department" : "Open Department"}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-[#8b949e] hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
            onClick={() => {
              onSetCapacity?.(department.name);
              setContextMenu(null);
            }}
          >
            Set Capacity
          </button>
        </div>
      )}
    </div>
  );
}

export const DepartmentNode = memo(DepartmentNodeComponent);
