// web/components/operations/department-card.tsx
"use client";

import type { DepartmentInfo, RoomInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DEPARTMENT_STATUS_STYLES, type DepartmentStatus } from "./operations-constants";

interface DepartmentCardProps {
  dept: DepartmentInfo;
  rooms: RoomInfo[];
  onClick: () => void;
}

export function DepartmentCard({ dept, rooms, onClick }: DepartmentCardProps) {
  const s = DEPARTMENT_STATUS_STYLES[dept.status as DepartmentStatus] ?? DEPARTMENT_STATUS_STYLES.IDLE;
  const isClosed = !dept.is_open;

  const sortedRooms = [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border px-3 py-2.5 flex flex-col gap-2 transition-colors hover:bg-muted/40 focus:outline-none",
        isClosed ? "opacity-50 border-border" : s.cardBorder,
      )}
    >
      {/* Header: name + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono font-medium text-foreground truncate">
          {dept.label}
        </span>
        {isClosed ? (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border shrink-0">
            CLOSED
          </span>
        ) : (
          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0", s.badgeText, s.badgeBg, s.badgeBorder)}>
            {dept.status}
          </span>
        )}
      </div>

      {/* Slots + queue */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
        <span>{dept.current_patient_count}/{dept.capacity} slots</span>
        {dept.queue_length > 0 && (
          <span className="px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500">
            +{dept.queue_length} queue
          </span>
        )}
      </div>

      {/* Room tiles */}
      {sortedRooms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sortedRooms.map((room) => {
            const occupied = room.current_visit_id !== null;
            return (
              <div
                key={room.id}
                title={occupied ? `${room.room_number} — ${room.patient_name ?? ""}` : room.room_number}
                className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded border",
                  occupied
                    ? "bg-muted/70 border-border text-foreground"
                    : "bg-transparent border-border/40 text-muted-foreground/40",
                )}
              >
                {room.room_number}
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
