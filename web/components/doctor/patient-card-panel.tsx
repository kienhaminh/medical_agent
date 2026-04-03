"use client";

import { useState, type ReactNode } from "react";
import { User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PatientDetail, VisitListItem } from "@/lib/api";
import { PatientImagingPanel } from "@/components/doctor/patient-imaging-panel";

interface PatientCardPanelProps {
  patient: PatientDetail | null;
  selectedVisit: VisitListItem | null;
}

type Tab = "overview" | "visit" | "records" | "imaging";

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

const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  urgent: "bg-amber-100 text-amber-700",
  routine: "bg-green-100 text-green-700",
};

export function PatientCardPanel({ patient, selectedVisit }: PatientCardPanelProps) {
  const [tab, setTab] = useState<Tab>("overview");

  if (!patient) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Select a patient from the list</p>
      </div>
    );
  }

  const age = calcAge(patient.dob);
  const urgency = selectedVisit?.urgency_level ?? null;
  const recordCount = patient.records?.length ?? 0;
  const imagingCount = patient.imaging?.length ?? 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "visit", label: "Visit" },
    { id: "records", label: "Records", count: recordCount },
    { id: "imaging", label: "Imaging", count: imagingCount },
  ];

  return (
    <div className="space-y-0">
      {/* Identity strip */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2">
        <div>
          <h3 className="text-sm font-semibold">{patient.name}</h3>
          <p className="text-xs text-muted-foreground">
            {age !== null && `${age}yo · `}
            {patient.gender && `${patient.gender} · `}
            DOB {patient.dob}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {urgency && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${URGENCY_BADGE[urgency] ?? ""}`}>
              {urgency}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1 text-primary hover:text-primary/80"
            onClick={() => window.open(`/patient/${patient.id}`, "_blank")}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 text-[11px] font-medium transition-colors relative ${
              tab === t.id
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 py-px text-[9px]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-3 py-2.5">
        {tab === "overview" && <OverviewTab visit={selectedVisit} />}
        {tab === "visit" && <VisitTab visit={selectedVisit} />}
        {tab === "records" && <RecordsTab records={patient.records} />}
        {tab === "imaging" && <ImagingTab imaging={patient.imaging} />}
      </div>
    </div>
  );
}

// --- Overview tab ---

function OverviewTab({ visit }: { visit: VisitListItem | null }) {
  if (!visit) {
    return <p className="text-xs text-muted-foreground">No visit selected.</p>;
  }
  return (
    <div className="space-y-2.5">
      {visit.chief_complaint && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Chief Complaint</p>
          <p className="text-xs">{visit.chief_complaint}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Department", value: visit.current_department },
          { label: "Doctor", value: visit.assigned_doctor },
          { label: "Queue", value: visit.queue_position != null ? `#${visit.queue_position}` : null },
          { label: "Wait", value: visit.wait_minutes != null ? `${visit.wait_minutes} min` : null },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/50 rounded px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-xs font-medium truncate">{value ?? "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Visit tab ---

function VisitTab({ visit }: { visit: VisitListItem | null }) {
  if (!visit) {
    return <p className="text-xs text-muted-foreground">No visit selected.</p>;
  }

  const routingChain = visit.routing_decision?.join(" → ") ?? null;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Status", value: <StatusBadge status={visit.status} /> },
    { label: "Urgency", value: <UrgencyBadge urgency={visit.urgency_level ?? null} /> },
    { label: "Department", value: visit.current_department ?? "—" },
    { label: "Assigned Doctor", value: visit.assigned_doctor ?? "—" },
    ...(routingChain ? [{ label: "Routing", value: routingChain }] : []),
    ...(visit.confidence != null
      ? [{ label: "Confidence", value: `${Math.round(visit.confidence * 100)}%` }]
      : []),
  ];

  return (
    <div className="divide-y divide-border">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between py-1.5 text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-right max-w-[55%] truncate">{value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">
      {status.replace(/_/g, " ")}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${URGENCY_BADGE[urgency] ?? ""}`}>
      {urgency}
    </span>
  );
}

// --- Records tab ---

const RECORD_ICON: Record<string, string> = {
  pdf: "📄",
  image: "🖼",
  text: "📝",
};

function RecordsTab({ records }: { records?: { id: number; title: string; record_type: string; file_url?: string; content?: string; created_at: string }[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!records?.length) {
    return <p className="text-xs text-muted-foreground">No records on file.</p>;
  }

  return (
    <div className="space-y-1.5">
      {records.map((rec) => {
        const hasLink = !!rec.file_url;
        const isText = rec.record_type === "text";
        const isOpen = expanded === rec.id;

        return (
          <div key={rec.id} className="border border-border rounded-md overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
              onClick={() => {
                if (hasLink) window.open(rec.file_url!, "_blank");
                else if (isText) setExpanded(isOpen ? null : rec.id);
              }}
            >
              <span className="text-base leading-none">{RECORD_ICON[rec.record_type] ?? "📎"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{rec.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {rec.record_type.toUpperCase()} · {new Date(rec.created_at).toLocaleDateString()}
                </p>
              </div>
              {hasLink && <ExternalLink className="h-3 w-3 text-primary shrink-0" />}
              {isText && !hasLink && (
                <span className="text-[10px] text-muted-foreground">{isOpen ? "▴" : "▾"}</span>
              )}
            </button>
            {isText && isOpen && rec.content && (
              <div className="px-2.5 py-2 border-t border-border bg-muted/30 text-xs whitespace-pre-wrap">
                {rec.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Imaging tab ---

function ImagingTab({ imaging }: { imaging?: { id: number; title: string; image_type: string; original_url: string; preview_url: string }[] }) {
  if (!imaging?.length) {
    return <p className="text-xs text-muted-foreground">No imaging on file.</p>;
  }
  return <PatientImagingPanel imaging={imaging} />;
}
