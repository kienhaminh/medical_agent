"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, FileText, Droplets } from "lucide-react";
import { parseNote } from "./clinical-note-parser";
import { Section } from "./clinical-note-section";

export function ClinicalNoteViewer({ content }: { content: string }) {
  const parsedNote = useMemo(() => parseNote(content), [content]);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6 border-2 border-border/50 bg-gradient-to-br from-cyan-500/5 to-teal-500/5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {parsedNote.title}
            </h2>

            {parsedNote.date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Calendar className="w-4 h-4" />
                <span>{parsedNote.date}</span>
              </div>
            )}

            {parsedNote.patientInfo && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                {parsedNote.patientInfo.name && (
                  <InfoField icon={<User className="w-4 h-4 text-cyan-500" />} label="Patient" value={parsedNote.patientInfo.name} />
                )}
                {parsedNote.patientInfo.age && (
                  <InfoField icon={<Calendar className="w-4 h-4 text-teal-500" />} label="Age" value={parsedNote.patientInfo.age} />
                )}
                {parsedNote.patientInfo.gender && (
                  <InfoField icon={<User className="w-4 h-4 text-purple-500" />} label="Gender" value={parsedNote.patientInfo.gender} className="capitalize" />
                )}
                {parsedNote.patientInfo.bloodType && (
                  <InfoField icon={<Droplets className="w-4 h-4 text-red-500" />} label="Blood Type" value={parsedNote.patientInfo.bloodType} />
                )}
                {parsedNote.patientInfo.id && (
                  <InfoField icon={<FileText className="w-4 h-4 text-blue-500" />} label="ID" value={parsedNote.patientInfo.id} />
                )}
              </div>
            )}
          </div>

          {parsedNote.diagnosis && (
            <div className="ml-4">
              <Badge
                variant="secondary"
                className="bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-4 py-2 text-sm"
              >
                <span className="font-semibold">{parsedNote.diagnosis.condition}</span>
                {parsedNote.diagnosis.icd10 && (
                  <span className="ml-2 text-xs opacity-75">({parsedNote.diagnosis.icd10})</span>
                )}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {parsedNote.sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`font-medium text-sm ${className ?? ""}`}>{value}</div>
      </div>
    </div>
  );
}
