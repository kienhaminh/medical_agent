// web/components/doctor/visit-queue-card.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Edit, Eye } from "lucide-react";
import type { VisitDetail } from "@/lib/api";

interface VisitQueueCardProps {
  visit: VisitDetail;
  onApprove: (visit: VisitDetail) => void;
  onChangeRoute: (visit: VisitDetail) => void;
  onViewIntake: (visit: VisitDetail) => void;
}

export function VisitQueueCard({
  visit,
  onApprove,
  onChangeRoute,
  onViewIntake,
}: VisitQueueCardProps) {
  const isNeedsReview = visit.status === "pending_review";

  return (
    <Card
      className={`p-4 ${
        isNeedsReview
          ? "border-orange-500/30 bg-orange-500/5"
          : "border-cyan-500/20 bg-cyan-500/3"
      }`}
    >
      <div className="flex gap-4">
        {/* Status dot */}
        <div
          className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
            isNeedsReview ? "bg-orange-500" : "bg-green-500"
          }`}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-semibold">{visit.patient_name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {visit.visit_id}
              </span>
            </div>
            <Badge
              className={
                isNeedsReview
                  ? "bg-orange-500/15 text-orange-500"
                  : "bg-green-500/15 text-green-500"
              }
            >
              {isNeedsReview ? "Needs Review" : "Auto-Routed"}
            </Badge>
          </div>

          {/* Chief complaint */}
          {visit.chief_complaint && (
            <p className="text-sm text-muted-foreground mt-2">
              {visit.chief_complaint}
            </p>
          )}

          {/* Routing info */}
          <div className="text-xs text-muted-foreground mt-2">
            {visit.routing_suggestion && (
              <span>
                Suggested:{" "}
                <span className="text-cyan-500">
                  {visit.routing_suggestion.join(", ")}
                </span>
              </span>
            )}
            {visit.confidence !== null && (
              <span className="ml-3">
                Confidence:{" "}
                <span
                  className={
                    visit.confidence >= 0.7 ? "text-green-500" : "text-orange-500"
                  }
                >
                  {(visit.confidence * 100).toFixed(0)}%
                </span>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {isNeedsReview && (
              <Button
                size="sm"
                onClick={() => onApprove(visit)}
                className="text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Approve Route
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onChangeRoute(visit)}
              className="text-xs"
            >
              <Edit className="w-3.5 h-3.5 mr-1" />
              Change Department
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewIntake(visit)}
              className="text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              View Intake
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
