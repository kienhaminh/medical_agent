"use client";

import { useState } from "react";
import { DepartmentInfo, VisitDetail, completeVisit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface DepartmentDetailProps {
  visit: VisitDetail;
  departments: DepartmentInfo[];
  onVisitUpdated: () => void;
}

function deptLabel(name: string, departments: DepartmentInfo[]): string {
  return departments.find((d) => d.name === name)?.label ?? name;
}

export function DepartmentDetail({ visit, departments, onVisitUpdated }: DepartmentDetailProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsCompleting(true);
    setError(null);
    try {
      await completeVisit(visit.id);
      onVisitUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete visit");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <Badge variant="outline" className="border-indigo-500/40 text-indigo-500 mb-2">
          In Department
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
          Department
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visit.routing_decision?.map((dept) => (
            <Badge key={dept} variant="secondary" className="text-xs">
              {deptLabel(dept, departments)}
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
          onClick={handleComplete}
          disabled={isCompleting}
          className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {isCompleting ? "Completing..." : "Complete Visit"}
        </Button>
      </div>
    </div>
  );
}
