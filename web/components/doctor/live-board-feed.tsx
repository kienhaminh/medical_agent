"use client";

import { useState, useEffect } from "react";
import { Activity, CheckCircle, ClipboardList, ArrowRightLeft } from "lucide-react";
import type { WSEvent, WSEventType } from "@/lib/ws-events";

interface ActivityEntry {
  id: string;
  icon: "check" | "claim" | "transfer" | "activity";
  text: string;
  timestamp: Date;
}

const MAX_ENTRIES = 20;

function entryFromEvent(event: WSEvent): ActivityEntry | null {
  const id = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const p = event.payload;

  switch (event.type as WSEventType) {
    case "order.claimed":
      return { id, icon: "claim", text: `${p.fulfilled_by} claimed ${p.order_name} for ${p.patient_name}`, timestamp: new Date() };
    case "order.completed":
      return { id, icon: "check", text: `${p.order_name} complete — ${p.patient_name}`, timestamp: new Date() };
    case "order.created":
      return { id, icon: "activity", text: `New order: ${p.order_name} (${p.ordered_by || "Doctor"})`, timestamp: new Date() };
    case "visit.checked_in":
      return { id, icon: "activity", text: `Patient checked into ${p.current_department}`, timestamp: new Date() };
    case "visit.completed":
      return { id, icon: "check", text: "Patient discharged", timestamp: new Date() };
    case "visit.transferred":
      return { id, icon: "transfer", text: `Patient transferred to ${p.new_department}`, timestamp: new Date() };
    default:
      return null;
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

const ICON_MAP = {
  check: CheckCircle,
  claim: ClipboardList,
  transfer: ArrowRightLeft,
  activity: Activity,
};

interface LiveBoardFeedProps {
  events: WSEvent[];
}

export function LiveBoardFeed({ events }: LiveBoardFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    const entry = entryFromEvent(latest);
    if (entry) {
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    }
  }, [events]);

  const latest = entries[0];
  const LatestIcon = latest ? ICON_MAP[latest.icon] : Activity;

  return (
    <div className="h-14 flex items-center gap-2 px-3">
      <Activity className="h-3 w-3 shrink-0 text-muted-foreground/40" />
      {latest ? (
        <>
          <LatestIcon className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          <span className="flex-1 text-[10px] text-muted-foreground/60 truncate leading-none">
            {latest.text}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/35 font-mono">
            {timeAgo(latest.timestamp)}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-muted-foreground/35">No recent activity</span>
      )}
    </div>
  );
}
