"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Activity,
  Microscope,
  Stethoscope,
  FileHeart,
} from "lucide-react";
import type { MedicalRecord } from "@/lib/api";

function getRecordIcon(record: MedicalRecord) {
  const summary = record.title?.toLowerCase() || "";

  if (summary.includes("registration")) {
    return <FileHeart className="w-5 h-5 text-purple-500" />;
  }
  if (summary.includes("routine") || summary.includes("laboratory")) {
    return <Microscope className="w-5 h-5 text-teal-500" />;
  }
  return <Stethoscope className="w-5 h-5 text-cyan-500" />;
}

function getRecordBadge(record: MedicalRecord) {
  const summary = record.title?.toLowerCase() || "";

  if (summary.includes("registration")) {
    return (
      <Badge
        variant="secondary"
        className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
      >
        Registration
      </Badge>
    );
  }
  if (summary.includes("routine") || summary.includes("laboratory")) {
    return (
      <Badge
        variant="secondary"
        className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30"
      >
        Lab Results
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
    >
      Clinical Note
    </Badge>
  );
}

interface MedicalRecordCardProps {
  record: MedicalRecord;
  viewMode: "grid" | "list";
  onClick: () => void;
}

export function MedicalRecordCard({ record, viewMode, onClick }: MedicalRecordCardProps) {
  return (
    <button onClick={onClick} className="text-left w-full">
      {viewMode === "grid" ? (
        <Card className="record-card group p-5 h-full">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 group-hover:scale-110 transition-transform">
                {getRecordIcon(record)}
              </div>
              <div className="flex-1 min-w-0">
                {getRecordBadge(record)}
              </div>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {new Date(record.created_at).toLocaleDateString()}
            </span>
          </div>

          <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors line-clamp-2">
            {record.title || "Medical Record"}
          </h3>

          {record.content && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {record.content.substring(0, 200)}...
            </p>
          )}
        </Card>
      ) : (
        <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10 group-hover:scale-110 transition-transform flex-shrink-0">
              {getRecordIcon(record)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                  {record.title || "Medical Record"}
                </h3>
                {getRecordBadge(record)}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(record.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {record.content && (
                  <span className="truncate max-w-md">
                    {record.content.substring(0, 100)}...
                  </span>
                )}
              </div>
            </div>

            <Activity className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </Card>
      )}
    </button>
  );
}
