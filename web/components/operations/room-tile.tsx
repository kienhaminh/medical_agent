// web/components/operations/room-tile.tsx
"use client";

import type { RoomInfo } from "@/lib/api";

interface RoomTileProps {
  room: RoomInfo;
  statusColor: string;
  onOccupiedClick: () => void;
}

export function RoomTile({ room, statusColor, onOccupiedClick }: RoomTileProps) {
  const isOccupied = room.current_visit_id !== null;
  return (
    <div
      onClick={isOccupied ? onOccupiedClick : undefined}
      className={`rounded-md px-2 py-1.5 border text-[10px] font-mono truncate ${
        isOccupied
          ? "cursor-pointer hover:brightness-110"
          : "opacity-50 cursor-default bg-muted text-muted-foreground border-border"
      }`}
      style={{
        background: isOccupied ? `${statusColor}18` : undefined,
        borderColor: isOccupied ? `${statusColor}40` : undefined,
        color: isOccupied ? statusColor : undefined,
      }}
    >
      <span className="font-bold">{room.room_number}</span>
      {" · "}
      <span>{room.patient_name ?? "—"}</span>
    </div>
  );
}
