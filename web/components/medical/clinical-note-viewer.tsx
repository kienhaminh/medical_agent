"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Thermometer,
  Heart,
  Wind,
  Droplets,
  Weight,
  Ruler,
  Calendar,
  User,
  FileText,
  Pill,
  AlertCircle,
  ClipboardList,
  Scan,
  Microscope,
  Stethoscope,
  TrendingUp,
  Info,
} from "lucide-react";

interface ClinicalSection {
  title: string;
  content: string;
  type: "header" | "section" | "list" | "vitals" | "labs" | "medications" | "text";
}

interface ParsedNote {
  title: string;
  date?: string;
  patientInfo?: {
    name?: string;
    id?: string;
    age?: string;
    gender?: string;
    bloodType?: string;
  };
  diagnosis?: {
    condition?: string;
    icd10?: string;
  };
  sections: ClinicalSection[];
}

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
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Patient</div>
                      <div className="font-medium text-sm">{parsedNote.patientInfo.name}</div>
                    </div>
                  </div>
                )}
                {parsedNote.patientInfo.age && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Age</div>
                      <div className="font-medium text-sm">{parsedNote.patientInfo.age}</div>
                    </div>
                  </div>
                )}
                {parsedNote.patientInfo.gender && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Gender</div>
                      <div className="font-medium text-sm capitalize">{parsedNote.patientInfo.gender}</div>
                    </div>
                  </div>
                )}
                {parsedNote.patientInfo.bloodType && (
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-red-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">Blood Type</div>
                      <div className="font-medium text-sm">{parsedNote.patientInfo.bloodType}</div>
                    </div>
                  </div>
                )}
                {parsedNote.patientInfo.id && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-xs text-muted-foreground">ID</div>
                      <div className="font-medium text-sm">{parsedNote.patientInfo.id}</div>
                    </div>
                  </div>
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
        {parsedNote.sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
      </div>
    </div>
  );
}

function Section({ section }: { section: ClinicalSection }) {
  const icon = getSectionIcon(section.title);
  const color = getSectionColor(section.title);

  if (section.type === "vitals") {
    return <VitalsSection content={section.content} />;
  }

  if (section.type === "labs") {
    return <LabsSection title={section.title} content={section.content} />;
  }

  if (section.type === "medications") {
    return <MedicationsSection content={section.content} />;
  }

  return (
    <Card className="p-5 hover:shadow-md transition-shadow border-border/50">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${color.bg}`}>
          {icon}
        </div>
        <h3 className={`font-display font-semibold text-lg flex-1 ${color.text}`}>
          {section.title}
        </h3>
      </div>

      <div className="pl-11">
        {section.type === "list" ? (
          <ul className="space-y-2">
            {section.content.split("\n").filter(Boolean).map((item, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-cyan-500 mt-1">•</span>
                <span className="flex-1">{item.replace(/^[•\-\*]\s*/, "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {section.content}
          </p>
        )}
      </div>
    </Card>
  );
}

function VitalsSection({ content }: { content: string }) {
  const vitals = parseVitals(content);

  return (
    <Card className="p-5 border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <Activity className="w-5 h-5 text-cyan-500" />
        </div>
        <h3 className="font-display font-semibold text-lg text-cyan-600 dark:text-cyan-400">
          Vital Signs
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {vitals.map((vital, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30"
          >
            {vital.icon}
            <div>
              <div className="text-xs text-muted-foreground">{vital.label}</div>
              <div className="font-semibold text-sm">{vital.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LabsSection({ title, content }: { title: string; content: string }) {
  const labs = parseLabValues(content);

  return (
    <Card className="p-5 border-2 border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-teal-500/10">
          <Microscope className="w-5 h-5 text-teal-500" />
        </div>
        <h3 className="font-display font-semibold text-lg text-teal-600 dark:text-teal-400">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {labs.map((lab, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              lab.flag === "H"
                ? "bg-red-500/5 border-red-500/30"
                : lab.flag === "L"
                ? "bg-blue-500/5 border-blue-500/30"
                : "bg-card/50 border-border/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{lab.name}</span>
              {lab.flag && (
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    lab.flag === "H"
                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                      : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {lab.flag}
                </Badge>
              )}
            </div>
            <span className="text-sm font-semibold text-foreground">{lab.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MedicationsSection({ content }: { content: string }) {
  const medications = content
    .split("\n")
    .filter((line) => line.trim().startsWith("•"))
    .map((line) => line.replace(/^[•\-\*]\s*/, "").trim());

  return (
    <Card className="p-5 border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Pill className="w-5 h-5 text-purple-500" />
        </div>
        <h3 className="font-display font-semibold text-lg text-purple-600 dark:text-purple-400">
          Medications Prescribed
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {medications.map((med, index) => (
          <div
            key={index}
            className="flex items-start gap-2 p-3 rounded-lg bg-card/50 border border-border/30"
          >
            <Pill className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-foreground">{med}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Helper Functions

function parseNote(content: string): ParsedNote {
  const lines = content.split("\n");
  const note: ParsedNote = {
    title: "Clinical Note",
    sections: [],
  };

  let currentSection: ClinicalSection | null = null;
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip separator lines
    if (line.match(/^[═━─]+$/)) continue;

    // Detect title
    if (i < 5 && (line.includes("CLINICAL ENCOUNTER") || line.includes("PATIENT REGISTRATION") || line.includes("ROUTINE LABORATORY"))) {
      note.title = line;
      continue;
    }

    // Extract date
    if (line.startsWith("Date:")) {
      note.date = line.replace("Date:", "").trim();
      continue;
    }

    // Extract patient info
    if (line.startsWith("Patient:")) {
      note.patientInfo = note.patientInfo || {};
      note.patientInfo.name = line.replace("Patient:", "").replace(/\(ID:.*\)/, "").trim();
    }
    if (line.includes("Patient ID:")) {
      note.patientInfo = note.patientInfo || {};
      note.patientInfo.id = line.split(":")[1]?.trim();
    }
    if (line.includes("Age:") && line.includes("years")) {
      note.patientInfo = note.patientInfo || {};
      const ageMatch = line.match(/Age:\s*(\d+)\s*years/);
      if (ageMatch) note.patientInfo.age = `${ageMatch[1]} years`;
    }
    if (line.includes("Gender:")) {
      note.patientInfo = note.patientInfo || {};
      const genderMatch = line.match(/Gender:\s*(\w+)/);
      if (genderMatch) note.patientInfo.gender = genderMatch[1];
    }
    if (line.includes("Blood Type:") || line.includes("Blood Group:")) {
      note.patientInfo = note.patientInfo || {};
      const bloodMatch = line.match(/Blood (?:Type|Group):\s*([ABO]\+|-)/);
      if (bloodMatch) note.patientInfo.bloodType = bloodMatch[1];
    }

    // Extract diagnosis
    if (line.startsWith("Diagnosis:")) {
      note.diagnosis = note.diagnosis || {};
      const diagMatch = line.match(/Diagnosis:\s*(.+?)\s*(?:\(ICD-10:\s*([A-Z0-9.]+)\))?$/);
      if (diagMatch) {
        note.diagnosis.condition = diagMatch[1].trim();
        if (diagMatch[2]) note.diagnosis.icd10 = diagMatch[2];
      }
    }

    // Detect section headers (all caps with colons)
    if (line.match(/^[A-Z\s\(\)]+:$/) && line.length > 3 && line.length < 60) {
      if (currentSection) {
        note.sections.push(currentSection);
      }

      const title = line.replace(":", "").trim();
      const type = getSectionType(title, "");

      currentSection = {
        title,
        content: "",
        type,
      };
      inSection = true;
      continue;
    }

    // Add content to current section
    if (inSection && currentSection && line) {
      if (currentSection.content) {
        currentSection.content += "\n" + line;
      } else {
        currentSection.content = line;
      }
    }
  }

  // Add last section
  if (currentSection) {
    note.sections.push(currentSection);
  }

  return note;
}

function getSectionType(title: string, content: string): ClinicalSection["type"] {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("vital signs") || titleLower.includes("vital")) {
    return "vitals";
  }
  if (
    titleLower.includes("laboratory") ||
    titleLower.includes("lab results") ||
    titleLower.includes("complete blood count") ||
    titleLower.includes("metabolic panel") ||
    titleLower.includes("lipid panel") ||
    titleLower.includes("liver function") ||
    titleLower.includes("thyroid")
  ) {
    return "labs";
  }
  if (titleLower.includes("medication")) {
    return "medications";
  }
  if (content.includes("•") || content.includes("-")) {
    return "list";
  }
  return "text";
}

function parseVitals(content: string): Array<{ icon: React.ReactElement; label: string; value: string }> {
  const vitals: Array<{ icon: React.ReactElement; label: string; value: string }> = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const cleanLine = line.replace(/^[•\-\*]\s*/, "").trim();
    if (!cleanLine || cleanLine.match(/^[═━─]+$/)) continue;

    if (cleanLine.includes("BP:") || cleanLine.includes("Blood Pressure:")) {
      vitals.push({
        icon: <Heart className="w-4 h-4 text-red-500" />,
        label: "Blood Pressure",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("HR:") || cleanLine.includes("Heart Rate:")) {
      vitals.push({
        icon: <Activity className="w-4 h-4 text-pink-500" />,
        label: "Heart Rate",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("RR:") || cleanLine.includes("Respiratory Rate:")) {
      vitals.push({
        icon: <Wind className="w-4 h-4 text-blue-500" />,
        label: "Respiratory Rate",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("Temp:") || cleanLine.includes("Temperature:")) {
      vitals.push({
        icon: <Thermometer className="w-4 h-4 text-orange-500" />,
        label: "Temperature",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("SpO2:") || cleanLine.includes("Oxygen Saturation:")) {
      vitals.push({
        icon: <Droplets className="w-4 h-4 text-cyan-500" />,
        label: "SpO2",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("Weight:")) {
      vitals.push({
        icon: <Weight className="w-4 h-4 text-purple-500" />,
        label: "Weight",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("Height:")) {
      vitals.push({
        icon: <Ruler className="w-4 h-4 text-green-500" />,
        label: "Height",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    } else if (cleanLine.includes("BMI:")) {
      vitals.push({
        icon: <TrendingUp className="w-4 h-4 text-teal-500" />,
        label: "BMI",
        value: cleanLine.split(":")[1]?.trim() || "",
      });
    }
  }

  return vitals;
}

function parseLabValues(content: string): Array<{ name: string; value: string; flag?: "H" | "L" }> {
  const labs: Array<{ name: string; value: string; flag?: "H" | "L" }> = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const cleanLine = line.replace(/^[•\-\*]\s*/, "").trim();
    if (!cleanLine || cleanLine.match(/^[═━─]+$/)) continue;

    const parts = cleanLine.split(":");
    if (parts.length === 2) {
      const name = parts[0].trim();
      const valueStr = parts[1].trim();

      // Detect abnormal flags
      let flag: "H" | "L" | undefined;
      if (valueStr.includes("(H)")) flag = "H";
      else if (valueStr.includes("(L)")) flag = "L";

      labs.push({
        name,
        value: valueStr.replace(/\([HL]\)/, "").trim(),
        flag,
      });
    }
  }

  return labs;
}

function getSectionIcon(title: string): React.ReactElement {
  const titleLower = title.toLowerCase();
  const className = "w-5 h-5";

  if (titleLower.includes("chief complaint")) {
    return <AlertCircle className={`${className} text-orange-500`} />;
  }
  if (titleLower.includes("history") || titleLower.includes("hpi")) {
    return <ClipboardList className={`${className} text-blue-500`} />;
  }
  if (titleLower.includes("physical") || titleLower.includes("examination")) {
    return <Stethoscope className={`${className} text-cyan-500`} />;
  }
  if (titleLower.includes("imaging") || titleLower.includes("study")) {
    return <Scan className={`${className} text-purple-500`} />;
  }
  if (titleLower.includes("laboratory") || titleLower.includes("lab")) {
    return <Microscope className={`${className} text-teal-500`} />;
  }
  if (titleLower.includes("medication")) {
    return <Pill className={`${className} text-purple-500`} />;
  }
  if (titleLower.includes("assessment") || titleLower.includes("plan") || titleLower.includes("treatment")) {
    return <FileText className={`${className} text-green-500`} />;
  }
  if (titleLower.includes("follow") || titleLower.includes("appointment")) {
    return <Calendar className={`${className} text-pink-500`} />;
  }
  if (titleLower.includes("social") || titleLower.includes("family") || titleLower.includes("allerg")) {
    return <User className={`${className} text-indigo-500`} />;
  }

  return <Info className={`${className} text-gray-500`} />;
}

function getSectionColor(title: string): { bg: string; text: string } {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("chief complaint")) {
    return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" };
  }
  if (titleLower.includes("history") || titleLower.includes("hpi")) {
    return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" };
  }
  if (titleLower.includes("physical") || titleLower.includes("examination")) {
    return { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" };
  }
  if (titleLower.includes("imaging")) {
    return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" };
  }
  if (titleLower.includes("laboratory") || titleLower.includes("lab")) {
    return { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" };
  }
  if (titleLower.includes("medication")) {
    return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" };
  }
  if (titleLower.includes("assessment") || titleLower.includes("plan") || titleLower.includes("treatment")) {
    return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" };
  }
  if (titleLower.includes("follow")) {
    return { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" };
  }

  return { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400" };
}
