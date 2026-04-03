// web/components/operations/department-card.tsx
"use client";

import type { DepartmentInfo, RoomInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DEPARTMENT_STATUS_STYLES, type DepartmentStatus } from "./operations-constants";
import { RoomTile } from "./room-tile";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  rooms: RoomInfo[];
}

// Circumference of r=20 circle
const CIRCUMFERENCE = 125.66;

export function DepartmentCard({ dept, rooms }: DepartmentCardProps) {
  const s = DEPARTMENT_STATUS_STYLES[dept.status as DepartmentStatus] ?? DEPARTMENT_STATUS_STYLES.IDLE;

  const utilization = dept.capacity > 0
    ? Math.round((dept.current_patient_count / dept.capacity) * 100)
    : 0;
  const filled = (utilization / 100) * CIRCUMFERENCE;

  const isClosed = !dept.is_open;
  const isCritical = dept.status === "CRITICAL";

  const sortedRooms = [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
  );

  return (
    <div className={cn(
      "w-full rounded-xl border transition-all",
      isCritical && "animate-pulse",
      isClosed ? "opacity-55 bg-muted border-border" : cn(s.cardBg, s.cardBorder, s.cardShadow),
    )}>
      {/* Header */}
      <div className="px-4 pt-3 pb-3">
        {/* Dept name + status badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={cn("text-sm font-bold font-mono truncate", isClosed ? "text-muted-foreground" : s.text)}>
            {dept.label}
          </span>
          {isClosed ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full text-red-400 bg-red-400/10 border border-red-400/20 shrink-0">
              CLOSED
            </span>
          ) : (
            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full border shrink-0", s.text, s.badgeBg, s.badgeBorder)}>
              {dept.status}
            </span>
          )}
        </div>

        {/* Utilization ring + slot count */}
        <div className="flex items-center gap-3">
          <svg width="44" height="44" className={cn("flex-shrink-0", isClosed ? "text-gray-500" : s.text)}>
            <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
            {dept.capacity > 0 && (
              <circle
                cx="22" cy="22" r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
            )}
            <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="10" fontFamily="monospace">
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
      </div>

      {/* Rooms — always visible vertical list */}
      {sortedRooms.length > 0 && (
        <>
          <hr className="border-0 border-t border-border mx-4" />
          <div className="px-4 pt-2 pb-3 space-y-1.5">
            {sortedRooms.map((room) => (
              <RoomTile key={room.id} room={room} status={dept.status as DepartmentStatus} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
