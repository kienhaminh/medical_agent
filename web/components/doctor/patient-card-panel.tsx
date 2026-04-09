"use client";

import { useState, type ReactNode } from "react";
import { User, ExternalLink, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PatientDetail, VisitListItem, Imaging, ImageGroup } from "@/lib/api";
import { ImagingAnalysisDialog } from "@/components/doctor/imaging-analysis-dialog";
import { PreVisitBriefCard } from "@/components/doctor/pre-visit-brief-card";

interface PatientCardPanelProps {
  patient: PatientDetail | null;
  selectedVisit: VisitListItem | null;
  visitBrief: string;
  briefLoading: boolean;
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

export function PatientCardPanel({ patient, selectedVisit, visitBrief, briefLoading }: PatientCardPanelProps) {
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
            type="button"
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
        {tab === "visit" && <VisitTab visit={selectedVisit} visitBrief={visitBrief} briefLoading={briefLoading} />}
        {tab === "records" && <RecordsTab records={patient.records} />}
        {tab === "imaging" && <ImagingTab key={patient.id} imaging={patient.imaging} imageGroups={patient.image_groups} patientId={patient.id} />}
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

function VisitTab({ visit, visitBrief, briefLoading }: { visit: VisitListItem | null; visitBrief: string; briefLoading: boolean }) {
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
    <div className="space-y-0">
      <div className="divide-y divide-border">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right max-w-[55%] truncate">{value}</span>
          </div>
        ))}
      </div>
      {(briefLoading || visitBrief) && (
        <div className="pt-2 -mx-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-3 mb-1">Pre-Visit Brief</p>
          <PreVisitBriefCard brief={visitBrief} loading={briefLoading} />
        </div>
      )}
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
              type="button"
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

function ImagingTab({
  imaging: initialImaging,
  imageGroups,
  patientId,
}: {
  imaging?: Imaging[];
  imageGroups?: ImageGroup[];
  patientId: number;
}) {
  const [imaging, setImaging] = useState<Imaging[]>(initialImaging ?? []);
  const [dialogGroup, setDialogGroup] = useState<Imaging[] | null>(null);

  if (!imaging.length) {
    return <p className="text-xs text-muted-foreground">No imaging on file.</p>;
  }

  // Group images by group_id; all null-group images form one shared study
  const groupMap = new Map<string, Imaging[]>();
  for (const img of imaging) {
    const key = img.group_id != null ? String(img.group_id) : "__ungrouped__";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(img);
  }

  const handleSegmentationComplete = (updated: Imaging) => {
    setImaging((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
  };

  const getGroupName = (key: string): string => {
    if (key === "__ungrouped__") return "MRI Study";
    const groupObj = imageGroups?.find((g) => String(g.id) === key);
    return groupObj?.name ?? `MRI Study #${key}`;
  };

  return (
    <>
      <div className="space-y-3">
        {Array.from(groupMap.entries()).map(([key, groupImages]) => {
          const isSegmented = groupImages.some(
            (img) => img.segmentation_result?.status === "success"
          );
          const groupName = getGroupName(key);
          const date = groupImages[0]?.created_at;

          return (
            <div
              key={key}
              className="rounded-md border border-border bg-muted/20 overflow-hidden"
            >
              {/* Study header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground truncate">
                    {groupName}
                  </span>
                  {date && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {isSegmented && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600 shrink-0 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Segmented
                  </span>
                )}
              </div>

              {/* 4-modality thumbnail grid */}
              <div className="grid grid-cols-4 gap-1 p-1.5">
                {groupImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative overflow-hidden rounded border border-border bg-black/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.preview_url}
                      alt={img.image_type}
                      className="w-full h-14 object-contain bg-black/5"
                    />
                    <div className="px-1 py-0.5 border-t border-border text-center">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wide">
                        {img.image_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Analyze button */}
              <div className="px-2.5 pb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDialogGroup(groupImages)}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  <Layers className="h-3 w-3" />
                  Analyze Study
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {dialogGroup && (
        <ImagingAnalysisDialog
          imagingGroup={dialogGroup}
          patientId={patientId}
          onClose={() => setDialogGroup(null)}
          onSegmentationComplete={handleSegmentationComplete}
        />
      )}
    </>
  );
}
