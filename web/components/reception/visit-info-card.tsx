"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Visit, Patient } from "@/lib/api";

interface VisitInfoCardProps {
  visit: Visit;
  patient: Patient;
}

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-cyan-500/15 text-cyan-500",
  triaged: "bg-blue-500/15 text-blue-500",
  auto_routed: "bg-green-500/15 text-green-500",
  pending_review: "bg-orange-500/15 text-orange-500",
  routed: "bg-green-500/15 text-green-500",
};

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake in progress",
  triaged: "Triaged",
  auto_routed: "Auto-Routed",
  pending_review: "Needs Doctor Review",
  routed: "Routed",
};

export function VisitInfoCard({ visit, patient }: VisitInfoCardProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4 bg-cyan-500/5 border-cyan-500/20">
        <div className="text-xs uppercase text-muted-foreground mb-2">Patient</div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center text-sm font-bold text-cyan-500">
            {patient.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <p className="font-semibold">{patient.name}</p>
            <p className="text-xs text-muted-foreground">DOB: {patient.dob} · {patient.gender}</p>
          </div>
        </div>
      </Card>
      <Card className="p-4 border-border/50">
        <div className="text-xs uppercase text-muted-foreground mb-2">Visit</div>
        <p className="text-sm font-mono text-muted-foreground">{visit.visit_id}</p>
        <div className="mt-2">
          <Badge className={STATUS_COLORS[visit.status] || "bg-muted"}>
            {STATUS_LABELS[visit.status] || visit.status}
          </Badge>
        </div>
        {visit.confidence !== null && (
          <div className="mt-3 text-xs text-muted-foreground">
            Confidence: <span className="font-medium">{(visit.confidence * 100).toFixed(0)}%</span>
          </div>
        )}
        {visit.routing_suggestion && (
          <div className="mt-2 text-xs text-muted-foreground">
            Suggested: <span className="text-cyan-500">{visit.routing_suggestion.join(", ")}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
