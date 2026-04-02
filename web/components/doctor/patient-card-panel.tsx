"use client";

import { User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PatientDetail } from "@/lib/api";

interface PatientCardPanelProps {
  patient: PatientDetail | null;
  chiefComplaint?: string;
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

export function PatientCardPanel({ patient, chiefComplaint }: PatientCardPanelProps) {
  if (!patient) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Select a patient from the list</p>
      </div>
    );
  }

  const age = calcAge(patient.dob);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{patient.name}</h3>
          <p className="text-xs text-muted-foreground">
            {age !== null && `${age}yo · `}
            {patient.gender && `${patient.gender} · `}
            DOB {patient.dob}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1 text-primary hover:text-primary/80"
          onClick={() => window.open(`/patient/${patient.id}`, "_blank")}
        >
          Full Record
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {chiefComplaint && (
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">Chief Complaint: </span>
          <span>{chiefComplaint}</span>
        </div>
      )}
    </div>
  );
}
