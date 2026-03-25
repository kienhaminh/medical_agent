// web/components/operations/department-card.tsx
"use client";

import type { DepartmentInfo } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS } from "./operations-constants";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  onClick: () => void;
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;

export function DepartmentCard({ dept, onClick }: DepartmentCardProps) {
  const statusColor =
    DEPARTMENT_STATUS_COLORS[dept.status as keyof typeof DEPARTMENT_STATUS_COLORS] ||
    "#6b7280";

  const utilization =
    dept.capacity > 0
      ? Math.round((dept.current_patient_count / dept.capacity) * 100)
      : 0;
  const filled = (utilization / 100) * CIRCUMFERENCE;

  const isClosed = !dept.is_open;
  const isCritical = dept.status === "CRITICAL";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border px-4 py-3 transition-all hover:brightness-110 focus:outline-none"
      style={{
        background: isClosed ? "rgba(255,255,255,0.02)" : `${statusColor}08`,
        borderColor: isClosed ? "rgba(255,255,255,0.08)" : `${statusColor}40`,
        boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
        opacity: isClosed ? 0.55 : 1,
        animation: isCritical ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="text-sm font-bold font-mono truncate"
          style={{ color: isClosed ? "#8b949e" : statusColor }}
        >
          {dept.label}
        </span>
        {isClosed ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full text-red-400 bg-red-400/10 border border-red-400/20 shrink-0">
            CLOSED
          </span>
        ) : (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              color: statusColor,
              background: `${statusColor}20`,
              border: `1px solid ${statusColor}30`,
            }}
          >
            {dept.status}
          </span>
        )}
      </div>

      {/* Utilization ring + slot count */}
      <div className="flex items-center gap-3">
        <svg width="44" height="44" className="flex-shrink-0">
          {/* Background track */}
          <circle
            cx="22" cy="22" r="20"
            fill="none"
            stroke={isClosed ? "rgba(255,255,255,0.06)" : `${statusColor}20`}
            strokeWidth="3"
          />
          {/* Filled arc — skip if capacity is 0 */}
          {dept.capacity > 0 && (
            <circle
              cx="22" cy="22" r="20"
              fill="none"
              stroke={isClosed ? "#6b7280" : statusColor}
              strokeWidth="3"
              strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
          )}
          <text
            x="22" y="22"
            textAnchor="middle"
            dominantBaseline="central"
            fill={isClosed ? "#6b7280" : statusColor}
            fontSize="10"
            fontFamily="monospace"
          >
            {dept.capacity > 0 ? `${utilization}%` : "—"}
          </text>
        </svg>

        <div className="min-w-0">
          <div className="text-xs font-mono text-[#8b949e]">
            {dept.current_patient_count}/{dept.capacity} slots
          </div>
          {dept.queue_length > 0 && (
            <div className="text-[10px] font-mono text-[#f59e0b] mt-0.5">
              {dept.queue_length} in queue
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
