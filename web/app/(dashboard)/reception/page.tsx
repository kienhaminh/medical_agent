"use client";

import { useState, useEffect } from "react";
import { PatientSelector } from "@/components/reception/patient-selector";
import { VisitInfoCard } from "@/components/reception/visit-info-card";
import { IntakeChat } from "@/components/reception/intake-chat";
import { getVisit, type Visit, type Patient } from "@/lib/api";

export default function ReceptionPage() {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Poll for visit status changes while intake is in progress
  useEffect(() => {
    if (!visit || visit.status !== "intake") return;

    const interval = setInterval(async () => {
      try {
        const updated = await getVisit(visit.id);
        if (updated.status !== "intake") setVisit(updated);
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [visit?.id, visit?.status]);

  const handleVisitCreated = (newVisit: Visit, selectedPatient: Patient) => {
    setVisit(newVisit);
    setPatient(selectedPatient);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="container mx-auto p-6 flex-1 flex flex-col min-h-0">
        <h1 className="font-display text-2xl font-bold mb-6">Reception</h1>
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left panel: patient selector or visit info */}
          <div className="w-[300px] flex-shrink-0 space-y-4 overflow-y-auto">
            {visit && patient ? (
              <VisitInfoCard visit={visit} patient={patient} />
            ) : (
              <PatientSelector onVisitCreated={handleVisitCreated} disabled={!!visit} />
            )}
          </div>

          {/* Right panel: intake chat or empty state */}
          <div className="flex-1 min-h-0">
            {visit ? (
              <IntakeChat visit={visit} patientId={visit.patient_id} />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-border/50 rounded-lg">
                <p className="text-muted-foreground">
                  Select a patient and start a visit to begin intake
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
