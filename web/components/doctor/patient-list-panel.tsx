"use client";

import { User, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VisitListItem } from "@/lib/api";
import { LiveBoardFeed } from "./live-board-feed";
import type { WSEvent } from "@/lib/ws-events";

interface PatientListPanelProps {
  myPatients: VisitListItem[];
  waitingRoom: VisitListItem[];
  loading: boolean;
  selectedVisitId: number | null;
  onSelectVisit: (visit: VisitListItem) => void;
  wsEvents: WSEvent[];
}

function UrgencyDot({ level }: { level?: string | null }) {
  const color = {
    critical: "bg-red-500",
    urgent: "bg-amber-500",
    routine: "bg-green-500",
  }[level as string] ?? "bg-green-500";

  return <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />;
}

function PatientCard({
  visit,
  selected,
  onSelect,
}: {
  visit: VisitListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md transition-colors",
        selected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted/50 border border-transparent",
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <UrgencyDot level={visit.urgency_level} />
        <span className="text-sm font-medium truncate flex-1">{visit.patient_name}</span>
        {visit.wait_minutes !== undefined && (
          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {visit.wait_minutes}m
          </span>
        )}
      </div>
      {visit.chief_complaint && (
        <p className="text-xs text-muted-foreground truncate pl-4">{visit.chief_complaint}</p>
      )}
    </button>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-muted/50">
        {count}
      </Badge>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-2 px-3 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5 p-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export function PatientListPanel({
  myPatients,
  waitingRoom,
  loading,
  selectedVisitId,
  onSelectVisit,
  wsEvents,
}: PatientListPanelProps) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
        <User className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Patients</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <QueueSkeleton />
        ) : (
          <>
            {/* My Patients */}
            <SectionHeader title="My Patients" count={myPatients.length} />
            {myPatients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 px-3">
                No patients assigned
              </p>
            ) : (
              <div className="space-y-0.5 px-1.5 pb-2">
                {myPatients.map((visit) => (
                  <PatientCard
                    key={visit.id}
                    visit={visit}
                    selected={visit.id === selectedVisitId}
                    onSelect={() => onSelectVisit(visit)}
                  />
                ))}
              </div>
            )}

            {/* Waiting Room */}
            <div className="border-t border-border/50">
              <SectionHeader title="Waiting Room" count={waitingRoom.length} />
              {waitingRoom.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 px-3">
                  No patients waiting
                </p>
              ) : (
                <div className="space-y-0.5 px-1.5 pb-2">
                  {waitingRoom.map((visit) => (
                    <PatientCard
                      key={visit.id}
                      visit={visit}
                      selected={visit.id === selectedVisitId}
                      onSelect={() => onSelectVisit(visit)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Live Board Feed */}
      <div className="border-t border-border">
        <LiveBoardFeed events={wsEvents} />
      </div>
    </div>
  );
}
