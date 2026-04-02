"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Activity } from "lucide-react";
import type { ErrorLog, UsageStats } from "@/lib/api";

interface ErrorTrackingTabProps {
  errorLogs: ErrorLog[];
  stats: UsageStats | null;
}

export function ErrorTrackingTab({ errorLogs, stats }: ErrorTrackingTabProps) {
  const errorCount = errorLogs.filter((e) => e.level === "error").length;
  const warningCount = errorLogs.filter((e) => e.level === "warning").length;
  const successRate = stats?.message_count
    ? (((stats.message_count - errorLogs.length) / stats.message_count) * 100).toFixed(1)
    : 100;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="record-card border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-500/10">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-sm text-muted-foreground">Critical Errors</p>
            </div>
          </div>
        </Card>

        <Card className="record-card border-yellow-500/30">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <AlertCircle className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{warningCount}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </Card>

        <Card className="record-card">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Error Logs */}
      <Card className="record-card">
        <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
          <div className="w-1 h-6 bg-red-500 rounded-full" />
          Recent Logs
        </h2>
        <div className="space-y-4">
          {errorLogs.map((error) => (
            <div key={error.id} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={error.level === "error" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}
                  >
                    {error.level.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-medium">{error.component}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(error.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-medium mb-1">{error.message}</p>
              <p className="text-xs text-muted-foreground">{error.details}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
