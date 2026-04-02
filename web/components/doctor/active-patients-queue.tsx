"use client";

import { User, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { VisitListItem } from "@/lib/api";

interface ActivePatientsQueueProps {
  visits: VisitListItem[];
  loading: boolean;
  onSelectVisit: (visit: VisitListItem) => void;
  onRefresh: () => void;
}

/** Colored pill badge indicating visit urgency level. */
function UrgencyBadge({ level }: { level?: string | null }) {
  const config = {
    critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200" },
    urgent: { label: "Urgent", className: "bg-amber-100 text-amber-700 border-amber-200" },
    routine: { label: "Routine", className: "bg-green-100 text-green-700 border-green-200" },
  };
  const c = config[level as keyof typeof config] ?? config.routine;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  );
}

/** Loading skeleton cards for the queue list. */
function QueueSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </>
  );
}

export function ActivePatientsQueue({
  visits,
  loading,
  onSelectVisit,
  onRefresh,
}: ActivePatientsQueueProps) {
  return (
    <div className="rounded-lg border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-primary/5">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">
            Active Patients
          </h2>
          {!loading && (
            <Badge
              variant="secondary"
              className="text-xs bg-primary/10 text-primary border-primary/30"
            >
              {visits.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
          title="Refresh queue"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Card list */}
      <div className="p-3 space-y-2">
        {loading ? (
          <QueueSkeleton />
        ) : visits.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <User className="w-6 h-6 opacity-40" />
              <p className="text-sm">No active patients in queue</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => (
              <button
                key={visit.id}
                onClick={() => onSelectVisit(visit)}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{visit.patient_name}</span>
                  <UrgencyBadge level={visit.urgency_level} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{visit.visit_id}</span>
                  {visit.current_department && (
                    <span>· {visit.current_department}</span>
                  )}
                  {visit.wait_minutes !== undefined && (
                    <span>· {visit.wait_minutes}m wait</span>
                  )}
                </div>
                {visit.chief_complaint && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {visit.chief_complaint}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
