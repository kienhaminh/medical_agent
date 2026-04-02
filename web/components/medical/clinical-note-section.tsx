"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { ClinicalSection } from "./clinical-note-parser";
import { parseVitals, parseLabValues } from "./clinical-note-parser";

// Icon map for vitals (avoids JSX in parser)
const VITAL_ICONS: Record<string, React.ReactElement> = {
  bp: <Heart className="w-4 h-4 text-red-500" />,
  hr: <Activity className="w-4 h-4 text-pink-500" />,
  rr: <Wind className="w-4 h-4 text-blue-500" />,
  temp: <Thermometer className="w-4 h-4 text-orange-500" />,
  spo2: <Droplets className="w-4 h-4 text-primary" />,
  weight: <Weight className="w-4 h-4 text-purple-500" />,
  height: <Ruler className="w-4 h-4 text-green-500" />,
  bmi: <TrendingUp className="w-4 h-4 text-primary" />,
};

export function Section({ section }: { section: ClinicalSection }) {
  if (section.type === "vitals") return <VitalsSection content={section.content} />;
  if (section.type === "labs") return <LabsSection title={section.title} content={section.content} />;
  if (section.type === "medications") return <MedicationsSection content={section.content} />;

  const icon = getSectionIcon(section.title);
  const color = getSectionColor(section.title);

  return (
    <Card className="p-5 hover:shadow-md transition-shadow border-border/50">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${color.bg}`}>{icon}</div>
        <h3 className={`font-display font-semibold text-lg flex-1 ${color.text}`}>
          {section.title}
        </h3>
      </div>

      <div className="pl-11">
        {section.type === "list" ? (
          <ul className="space-y-2">
            {section.content.split("\n").filter(Boolean).map((item) => (
              <li key={item} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
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
    <Card className="p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-lg text-primary">
          Vital Signs
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {vitals.map((vital) => (
          <div
            key={vital.label}
            className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30"
          >
            {VITAL_ICONS[vital.iconKey]}
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
    <Card className="p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Microscope className="w-5 h-5 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-lg text-primary">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {labs.map((lab) => (
          <div
            key={lab.name}
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
        {medications.map((med) => (
          <div
            key={med}
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

function getSectionIcon(title: string): React.ReactElement {
  const t = title.toLowerCase();
  const cls = "w-5 h-5";

  if (t.includes("chief complaint")) return <AlertCircle className={`${cls} text-orange-500`} />;
  if (t.includes("history") || t.includes("hpi")) return <ClipboardList className={`${cls} text-blue-500`} />;
  if (t.includes("physical") || t.includes("examination")) return <Stethoscope className={`${cls} text-primary`} />;
  if (t.includes("imaging") || t.includes("study")) return <Scan className={`${cls} text-purple-500`} />;
  if (t.includes("laboratory") || t.includes("lab")) return <Microscope className={`${cls} text-primary`} />;
  if (t.includes("medication")) return <Pill className={`${cls} text-purple-500`} />;
  if (t.includes("assessment") || t.includes("plan") || t.includes("treatment")) return <FileText className={`${cls} text-green-500`} />;
  if (t.includes("follow") || t.includes("appointment")) return <Calendar className={`${cls} text-pink-500`} />;
  if (t.includes("social") || t.includes("family") || t.includes("allerg")) return <User className={`${cls} text-indigo-500`} />;

  return <Info className={`${cls} text-gray-500`} />;
}

function getSectionColor(title: string): { bg: string; text: string } {
  const t = title.toLowerCase();

  if (t.includes("chief complaint")) return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" };
  if (t.includes("history") || t.includes("hpi")) return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" };
  if (t.includes("physical") || t.includes("examination")) return { bg: "bg-primary/10", text: "text-primary" };
  if (t.includes("imaging")) return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" };
  if (t.includes("laboratory") || t.includes("lab")) return { bg: "bg-primary/10", text: "text-primary" };
  if (t.includes("medication")) return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" };
  if (t.includes("assessment") || t.includes("plan") || t.includes("treatment")) return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400" };
  if (t.includes("follow")) return { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" };

  return { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400" };
}
