"use client";

import { Card } from "@/components/ui/card";

import { Activity, CheckCircle2, Calendar } from "lucide-react";
import type { PatientWithDetails } from "@/lib/mock-data";

interface HealthOverviewProps {
  patient: PatientWithDetails;
}

export function HealthOverview({ patient }: HealthOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Medical Records</p>
              <p className="text-2xl font-bold font-display">
                {patient.records?.length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Imaging</p>
              <p className="text-2xl font-bold font-display">
                {patient.imaging?.length || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Image Groups</p>
              <p className="text-2xl font-bold font-display">
                {patient.image_groups?.length || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
