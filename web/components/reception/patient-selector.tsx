"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Search, UserPlus } from "lucide-react";
import { getPatients, createVisit, type Patient, type Visit } from "@/lib/api";

interface PatientSelectorProps {
  onVisitCreated: (visit: Visit, patient: Patient) => void;
  disabled?: boolean;
}

export function PatientSelector({ onVisitCreated, disabled }: PatientSelectorProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPatients().then(setPatients).catch(console.error);
  }, []);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartVisit = async () => {
    if (!selectedPatient || creating) return;
    setCreating(true);
    setError(null);
    try {
      const visit = await createVisit(selectedPatient.id);
      onVisitCreated(visit, selectedPatient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create visit");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 medical-input"
          disabled={disabled}
        />
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filtered.map((patient) => (
          <Card
            key={patient.id}
            className={`p-3 cursor-pointer transition-all ${
              selectedPatient?.id === patient.id
                ? "border-cyan-500 bg-cyan-500/5"
                : "border-border/50 hover:border-cyan-500/50"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
            onClick={() => setSelectedPatient(patient)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-xs font-bold text-cyan-500">
                {patient.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <p className="font-medium text-sm">{patient.name}</p>
                <p className="text-xs text-muted-foreground">
                  DOB: {patient.dob} · {patient.gender}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No patients found</p>
        )}
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}
      <Button
        onClick={handleStartVisit}
        disabled={!selectedPatient || creating || disabled}
        className="w-full primary-button"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Visit...
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4 mr-2" />
            Start Visit
          </>
        )}
      </Button>
    </div>
  );
}
