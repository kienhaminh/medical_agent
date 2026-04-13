// web/components/operations/room-tile.tsx
"use client";

import type { RoomInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RoomTileProps {
  room: RoomInfo;
}

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function RoomTile({ room }: RoomTileProps) {
  const isOccupied = room.current_visit_id !== null;

  return (
    <div className={cn(
      "rounded-md px-2 py-1.5 border text-[10px] font-mono border-border",
      isOccupied
        ? "bg-muted/60 text-foreground"
        : "opacity-40 bg-muted text-muted-foreground",
    )}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold">{room.room_number}</span>
        {room.checked_in_at && (
          <span className="opacity-70">{formatTimeAgo(room.checked_in_at)}</span>
        )}
      </div>
      <div className="truncate mt-0.5">{room.patient_name ?? "—"}</div>
      {room.chief_complaint && (
        <div className="truncate opacity-70 mt-0.5">{room.chief_complaint}</div>
      )}
    </div>
  );
}
