"use client";

import Link from "next/link";
import type { Patient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Calendar, ArrowRight } from "lucide-react";

function genderVariant(gender: string) {
  if (gender === "Male") return "mri" as const;
  if (gender === "Female") return "xray" as const;
  return "clinical" as const;
}

interface PatientCardProps {
  patient: Patient;
  viewMode: "grid" | "list";
}

export function PatientCard({ patient, viewMode }: PatientCardProps) {
  return (
    <Link href={`/patient/${patient.id}`}>
      {viewMode === "grid" ? (
        <Card className="record-card group">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold group-hover:text-primary transition-colors">
                  {patient.name}
                </h3>
                <p className="text-xs text-muted-foreground">Patient ID: #{patient.id}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">DOB:</span>
              <span className="font-medium">{patient.dob}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={genderVariant(patient.gender)}>{patient.gender}</Badge>
              <span className="text-xs text-muted-foreground">
                Added {new Date(patient.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110 transition-transform flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-display text-base font-semibold group-hover:text-primary transition-colors truncate">
                  {patient.name}
                </h3>
                <Badge variant={genderVariant(patient.gender)} className="flex-shrink-0">
                  {patient.gender}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">ID:</span> #{patient.id}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {patient.dob}
                </span>
                <span>Added {new Date(patient.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </Card>
      )}
    </Link>
  );
}
