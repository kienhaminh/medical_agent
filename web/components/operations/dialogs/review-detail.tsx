"use client";

import { useState } from "react";
import { type DepartmentInfo, type VisitDetail, routeVisit, checkInVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightCircle, CheckCircle, Edit3 } from "lucide-react";
import { deptLabel } from "../operations-constants";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  intake: { label: "Intake", className: "border-blue-500/40 text-blue-500" },
  triaged: { label: "Triaged", className: "border-sky-500/40 text-sky-500" },
  auto_routed: { label: "Auto-Routed", className: "border-violet-500/40 text-violet-500" },
  pending_review: { label: "Needs Review", className: "border-amber-500/40 text-amber-500" },
  routed: { label: "Routed", className: "border-emerald-500/40 text-emerald-500" },
};

const REVIEWABLE_STATUSES = ["pending_review", "auto_routed"];

interface ReviewDetailProps {
  visit: VisitDetail;
  departments: DepartmentInfo[];
  onVisitUpdated: () => void;
}

export function ReviewDetail({ visit, departments, onVisitUpdated }: ReviewDetailProps) {
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    visit.routing_suggestion || []
  );
  const [reviewedBy, setReviewedBy] = useState("");
  const [isRouting, setIsRouting] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReview = REVIEWABLE_STATUSES.includes(visit.status);
  const canCheckIn = visit.status === "routed";
  const statusConfig = STATUS_CONFIG[visit.status] ?? {
    label: visit.status.replaceAll("_", " "),
    className: "border-zinc-500/40 text-zinc-500",
  };

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

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setError(null);
    try {
      await checkInVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in visit");
    } finally {
      setIsCheckingIn(false);
    }
  };

  const toggleDept = (deptName: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptName) ? prev.filter((d) => d !== deptName) : [...prev, deptName]
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.label}
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

      {/* Chief Complaint */}
      {visit.chief_complaint && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Chief Complaint
          </p>
          <p className="text-sm text-foreground">{visit.chief_complaint}</p>
        </div>
      )}

      {/* Intake Notes */}
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

      {/* Routing section — only for reviewable visits */}
      {canReview && (
        <>
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
                  {deptLabel(dept, departments)}
                </Badge>
              ))}
              {selectedDepts.length === 0 && (
                <span className="text-xs text-muted-foreground">No department suggested</span>
              )}
            </div>
            {showDeptSelector && (
              <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-lg border border-border/40 bg-background/40">
                {departments.map((dept) => (
                  <button
                    key={dept.name}
                    onClick={() => toggleDept(dept.name)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      selectedDepts.includes(dept.name)
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {dept.label}
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
              className="w-full bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isRouting ? "Routing..." : "Approve Route"}
            </Button>
          </div>
        </>
      )}

      {/* Routed visits — show assigned departments + check-in action */}
      {canCheckIn && (
        <>
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
              Assigned Departments
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(visit.routing_decision ?? visit.routing_suggestion ?? []).map((dept) => (
                <Badge key={dept} variant="secondary" className="text-xs">
                  {deptLabel(dept, departments)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="border-t border-border/40 pt-3 mt-auto">
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <Button
              onClick={handleCheckIn}
              disabled={isCheckingIn}
              className="w-full bg-gradient-to-r from-emerald-500 to-primary hover:from-emerald-600 hover:to-primary/90 text-white"
            >
              <ArrowRightCircle className="w-4 h-4 mr-2" />
              {isCheckingIn ? "Checking In..." : "Check In to Department"}
            </Button>
          </div>
        </>
      )}

      {/* Read-only routing info for intake/triaged visits */}
      {!canReview && !canCheckIn && visit.routing_suggestion && visit.routing_suggestion.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
            Suggested Routing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visit.routing_suggestion.map((dept) => (
              <Badge key={dept} variant="secondary" className="text-xs">
                {deptLabel(dept, departments)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
