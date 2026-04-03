// web/components/operations/department-card.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { DepartmentInfo, VisitListItem, RoomInfo } from "@/lib/api";
import { DEPARTMENT_STATUS_COLORS, getWaitTimeColor, formatTimeAgo } from "./operations-constants";
import { RoomTile } from "./room-tile";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  visits: VisitListItem[];
  rooms: RoomInfo[];
  onClick: () => void;
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;
const MAX_VISIBLE = 5;

function sortVisits(visits: VisitListItem[]): VisitListItem[] {
  return [...visits].sort((a, b) => {
    const posA = a.queue_position ?? Infinity;
    const posB = b.queue_position ?? Infinity;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function DepartmentCard({ dept, visits, rooms, onClick }: DepartmentCardProps) {
  const [expanded, setExpanded] = useState(false);

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

  const sorted = sortVisits(visits);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;
  const sortedRooms = [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
  );

  return (
    <div
      className={`w-full rounded-xl border transition-all ${isCritical ? "animate-pulse" : ""} ${isClosed ? "opacity-[0.55]" : ""}`}
      style={{
        background: isClosed ? "var(--muted)" : `${statusColor}08`,
        borderColor: isClosed ? "var(--border)" : `${statusColor}40`,
        boxShadow: isCritical ? `0 0 20px ${statusColor}30` : "none",
      }}
    >
      {/* Header — clicking dept name/stats opens dialog; chevron toggles rooms */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-3">
        <button
          onClick={onClick}
          className="flex-1 text-left hover:brightness-110 focus:outline-none min-w-0"
        >
          {/* Dept name + status badge */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className="text-sm font-bold font-mono truncate"
              style={{ color: isClosed ? "var(--muted-foreground)" : statusColor }}
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
              <circle cx="22" cy="22" r="20" fill="none" stroke={isClosed ? "var(--border)" : `${statusColor}20`} strokeWidth="3" />
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
              <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill={isClosed ? "#6b7280" : statusColor} fontSize="10" fontFamily="monospace">
                {dept.capacity > 0 ? `${utilization}%` : "—"}
              </text>
            </svg>
            <div className="min-w-0">
              <div className="text-xs font-mono text-muted-foreground">
                {dept.current_patient_count}/{dept.capacity} slots
              </div>
              {dept.queue_length > 0 && (
                <div className="text-[10px] font-mono text-amber-500 mt-0.5">
                  {dept.queue_length} in queue
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Expand/collapse toggle — only shown if rooms exist */}
        {sortedRooms.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1 rounded hover:bg-white/5 focus:outline-none"
            style={{ color: statusColor }}
            aria-label={expanded ? "Collapse rooms" : "Expand rooms"}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Rooms section */}
      {expanded && sortedRooms.length > 0 && (
        <>
          <hr className="border-0 border-t border-border mx-4" />
          <div className="px-4 pt-2 pb-3 grid grid-cols-2 gap-1.5">
            {sortedRooms.map((room) => (
              <RoomTile
                key={room.id}
                room={room}
                statusColor={statusColor}
                onOccupiedClick={onClick}
              />
            ))}
          </div>
        </>
      )}

      {/* Patient list */}
      {visible.length > 0 && (
        <>
          <hr className="border-0 border-t border-border mx-4" />
          <div className="px-4 pt-2 pb-3 space-y-1.5">
            {visible.map((v) => {
              const waitColor = getWaitTimeColor(v.created_at);
              return (
                <div key={v.visit_id} className="rounded-md px-2 py-1.5 bg-muted/30 border border-border">
                  <div className="text-[11px] font-bold font-mono text-foreground truncate">
                    {v.patient_name}
                  </div>
                  {v.chief_complaint && (
                    <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                      {v.chief_complaint}
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] font-mono" style={{ color: waitColor }}>
                      {formatTimeAgo(v.created_at)}
                    </span>
                    {v.queue_position != null && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{v.queue_position}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="text-[10px] font-mono text-muted-foreground text-center pt-1">
                +{overflow} more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
