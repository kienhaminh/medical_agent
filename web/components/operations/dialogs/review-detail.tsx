"use client";

import { useState } from "react";
import { VisitDetail, routeVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Edit3 } from "lucide-react";

const DEPARTMENTS = [
  "Cardiology", "Pulmonology", "Neurology", "Gastroenterology",
  "Orthopedics", "Dermatology", "Psychiatry", "Oncology",
  "Nephrology", "Endocrinology", "Emergency", "General Medicine",
  "Ophthalmology", "ENT",
];

interface ReviewDetailProps {
  visit: VisitDetail;
  onVisitUpdated: () => void;
}

export function ReviewDetail({ visit, onVisitUpdated }: ReviewDetailProps) {
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    visit.routing_suggestion || []
  );
  const [reviewedBy, setReviewedBy] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!reviewedBy.trim()) {
      setError("Please enter your name");
      return;
    }
    setIsRouting(true);
    setError(null);
    try {
      await routeVisit(visit.id, selectedDepts, reviewedBy.trim());
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to route visit");
    } finally {
      setIsRouting(false);
    }
  };

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const isPendingReview = visit.status === "pending_review";

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant="outline"
            className={
              isPendingReview
                ? "border-amber-500/40 text-amber-500"
                : "border-violet-500/40 text-violet-500"
            }
          >
            {isPendingReview ? "Needs Review" : "Auto-Routed"}
          </Badge>
          {visit.confidence !== null && (
            <span className="text-xs text-muted-foreground">
              Confidence: {(visit.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
      </div>

      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      {visit.intake_notes && (
        <div className="flex-1 min-h-0">
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Intake Notes
          </p>
          <ScrollArea className="max-h-40 rounded-lg border border-border/40 bg-background/40 p-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {visit.intake_notes}
            </p>
          </ScrollArea>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Routing
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowDeptSelector(!showDeptSelector)}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Change
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selectedDepts.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {dept}
            </Badge>
          ))}
        </div>
        {showDeptSelector && (
          <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-lg border border-border/40 bg-background/40">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => toggleDept(dept)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  selectedDepts.includes(dept)
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-400"
                    : "border-border/40 text-muted-foreground hover:border-border"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border/40 pt-3 mt-auto">
        <Input
          placeholder="Reviewed by (your name)"
          value={reviewedBy}
          onChange={(e) => setReviewedBy(e.target.value)}
          className="mb-2 bg-card/50 text-sm"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <Button
          onClick={handleApprove}
          disabled={isRouting || selectedDepts.length === 0}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {isRouting ? "Routing..." : "Approve Route"}
        </Button>
      </div>
    </div>
  );
}
