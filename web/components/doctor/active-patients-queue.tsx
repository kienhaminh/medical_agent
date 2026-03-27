"use client";

import { Clock, User, ArrowRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { VisitListItem } from "@/lib/api";
import { formatTimeAgo } from "@/components/operations/operations-constants";

interface ActivePatientsQueueProps {
  visits: VisitListItem[];
  loading: boolean;
  onSelectVisit: (visit: VisitListItem) => void;
  onRefresh: () => void;
}

/** Loading skeleton rows for the queue table. */
function QueueSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-b border-border/30">
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-24" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-40" />
          </td>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </td>
        </tr>
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/5 to-teal-500/5">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-500" />
          <h2 className="font-display text-sm font-semibold">
            Active Patients
          </h2>
          {!loading && (
            <Badge
              variant="secondary"
              className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            >
              {visits.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          className="h-7 w-7 hover:bg-cyan-500/10 hover:text-cyan-400"
          title="Refresh queue"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-xs">
              <th className="px-4 py-2 text-left font-medium">Patient</th>
              <th className="px-4 py-2 text-left font-medium">Visit ID</th>
              <th className="px-4 py-2 text-left font-medium">Department</th>
              <th className="px-4 py-2 text-left font-medium">Complaint</th>
              <th className="px-4 py-2 text-left font-medium">
                <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
                Wait
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <QueueSkeleton />
            ) : visits.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-6 h-6 opacity-40" />
                    <p className="text-sm">No active patients in queue</p>
                  </div>
                </td>
              </tr>
            ) : (
              visits.map((visit) => (
                <tr
                  key={visit.id}
                  onClick={() => onSelectVisit(visit)}
                  className="border-b border-border/30 hover:bg-cyan-500/5 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{visit.patient_name}</span>
                      <ArrowRight className="w-3 h-3 text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {visit.visit_id}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className="text-xs border-cyan-500/30 text-cyan-400"
                    >
                      {visit.current_department ?? "N/A"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {visit.chief_complaint ?? "No complaint recorded"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {formatTimeAgo(visit.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
