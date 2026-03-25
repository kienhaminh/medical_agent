// web/components/operations/canvas/department-node.tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DepartmentInfo, VisitListItem } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "../operations-constants";
import { QueueTail } from "./queue-tail";

interface DepartmentNodeData {
  department: DepartmentInfo;
  visits: VisitListItem[];
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department, visits } = data as unknown as DepartmentNodeData;
  const statusColor = DEPARTMENT_STATUS_COLORS[department.status as keyof typeof DEPARTMENT_STATUS_COLORS] || "#6b7280";
  const isCritical = department.status === "CRITICAL";
  const utilization = department.capacity > 0
    ? Math.round((department.current_patient_count / department.capacity) * 100)
    : 0;

  // Capacity ring: circumference of r=20 circle = 125.66
  const circumference = 125.66;
  const filled = (utilization / 100) * circumference;

  return (
    <div className="relative">
      <QueueTail visits={visits} />
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className="rounded-xl border px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all"
        style={{
          background: `${statusColor}08`,
          borderColor: `${statusColor}40`,
          boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
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
    </div>
  );
}

export const DepartmentNode = memo(DepartmentNodeComponent);
