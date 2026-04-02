"use client";

import { useState } from "react";
import { VisitDetail, checkInVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn } from "lucide-react";

interface RoutedDetailProps {
  visit: VisitDetail;
  onVisitUpdated: () => void;
}

export function RoutedDetail({ visit, onVisitUpdated }: RoutedDetailProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async () => {
    setIsChecking(true);
    setError(null);
    try {
      await checkInVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 mb-2">
          Routed
        </Badge>
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

      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">
          Routing Decision
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visit.routing_decision?.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {dept}
            </Badge>
          ))}
        </div>
        {visit.reviewed_by && (
          <p className="text-xs text-muted-foreground mt-2">
            Reviewed by: {visit.reviewed_by}
          </p>
        )}
      </div>

      <div className="border-t border-border/40 pt-3 mt-auto">
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <Button
          onClick={handleCheckIn}
          disabled={isChecking}
          className="w-full bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-white"
        >
          <LogIn className="w-4 h-4 mr-2" />
          {isChecking ? "Checking in..." : "Check In to Department"}
        </Button>
      </div>
    </div>
  );
}
