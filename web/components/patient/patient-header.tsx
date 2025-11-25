"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Calendar, ChevronLeft, Upload, Sparkles } from "lucide-react";
import type { PatientWithDetails } from "@/lib/mock-data";

interface PatientHeaderProps {
  patient: PatientWithDetails;
  sessionId: string | null;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  setUploadOpen: (open: boolean) => void;
}

export function PatientHeader({
  patient,
  sessionId,
  aiOpen,
  setAiOpen,
  setUploadOpen,
}: PatientHeaderProps) {
  const router = useRouter();

  return (
    <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (sessionId) {
                  router.push(`/agent?session=${sessionId}`);
                } else {
                  router.push("/patient");
                }
              }}
              className="hover:bg-cyan-500/10"
              title={sessionId ? "Back to Chat" : "Back to Patients"}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div>
              {sessionId && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span
                    className="text-cyan-500 cursor-pointer hover:underline"
                    onClick={() => router.push(`/agent?session=${sessionId}`)}
                  >
                    Agent Chat
                  </span>
                  <span>/</span>
                  <span>Patient: {patient.name}</span>
                </div>
              )}
              <h1 className="font-display text-2xl font-bold flex items-center gap-3">
                <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
                {patient.name}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {patient.gender}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  DOB: {patient.dob}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant="secondary" className="medical-badge-text">
                  ID: #{patient.id}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setUploadOpen(true)}
              className="secondary-button"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
            <Button
              onClick={() => setAiOpen(!aiOpen)}
              className={aiOpen ? "secondary-button" : "primary-button"}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {aiOpen ? "Close AI" : "AI Assistant"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
