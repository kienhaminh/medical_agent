"use client";

import { User, Calendar, FileText, AlertCircle, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PatientDetail, VisitListItem } from "@/lib/api";

interface PatientSnapshotProps {
  patient: PatientDetail | null;
  visit: VisitListItem | null;
  loading: boolean;
}

/** Skeleton placeholder while patient data loads. */
function SnapshotSkeleton() {
  return (
    <Card className="p-4 border-border bg-card/30 backdrop-blur-sm space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
      </div>
    </Card>
  );
}

export function PatientSnapshot({
  patient,
  visit,
  loading,
}: PatientSnapshotProps) {
  if (loading) return <SnapshotSkeleton />;

  if (!patient) {
    return (
      <Card className="p-6 border-border bg-card/30 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertCircle className="w-6 h-6 opacity-40" />
          <p className="text-sm">Select a patient to view details</p>
        </div>
      </Card>
    );
  }

  const recordsCount = patient.records?.length ?? 0;
  const imagingCount = patient.imaging?.length ?? 0;
  const lastRecordDate =
    patient.records && patient.records.length > 0
      ? new Date(
          patient.records[patient.records.length - 1].created_at
        ).toLocaleDateString()
      : "N/A";

  return (
    <Card className="border-border bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Patient identity header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-cyan-500/5 to-teal-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-cyan-500" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold truncate">
            {patient.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            DOB: {patient.dob} | {patient.gender} | ID: {patient.id}
          </p>
        </div>
      </div>

      {/* Info grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Current visit */}
        <div className="rounded-md border border-border/50 bg-card/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            Visit
          </div>
          {visit ? (
            <>
              <p className="text-xs font-mono text-cyan-400">
                {visit.visit_id}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] border-cyan-500/30 text-cyan-400"
              >
                {visit.status}
              </Badge>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No active visit</p>
          )}
        </div>

        {/* Department and complaint */}
        <div className="rounded-md border border-border/50 bg-card/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            Complaint
          </div>
          {visit ? (
            <>
              <p className="text-xs truncate">
                {visit.chief_complaint ?? "None"}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] border-teal-500/30 text-teal-400"
              >
                {visit.current_department ?? "N/A"}
              </Badge>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">--</p>
          )}
        </div>

        {/* Records count */}
        <div className="rounded-md border border-border/50 bg-card/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            Records
          </div>
          <p className="text-sm font-semibold">{recordsCount}</p>
          <p className="text-[10px] text-muted-foreground">
            Last: {lastRecordDate}
          </p>
        </div>

        {/* Imaging count */}
        <div className="rounded-md border border-border/50 bg-card/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Image className="w-3 h-3" />
            Imaging
          </div>
          <p className="text-sm font-semibold">{imagingCount}</p>
          <p className="text-[10px] text-muted-foreground">
            {imagingCount === 0 ? "No images" : `${imagingCount} file(s)`}
          </p>
        </div>
      </div>
    </Card>
  );
}
