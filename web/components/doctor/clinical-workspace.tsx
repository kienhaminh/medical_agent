"use client";

import { useState, useCallback, useEffect } from "react";
import {
  User,
  FileEdit,
  Brain,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CollapsiblePanel } from "./collapsible-panel";
import { PatientCardPanel } from "./patient-card-panel";
import { ClinicalNotesEditor } from "./clinical-notes-editor";
import { DdxPanel } from "./ddx-panel";
import { QuickActionsBar } from "./quick-actions-bar";
import type { PatientDetail, DiagnosisItem, VisitListItem, DepartmentInfo } from "@/lib/api";

const STORAGE_KEY = "medinexus_panel_state";

interface ClinicalWorkspaceProps {
  // Patient
  patient: PatientDetail | null;
  selectedVisit: VisitListItem | null;

  // Pre-visit brief
  visitBrief: string;
  briefLoading: boolean;

  // Clinical notes
  clinicalNotes: string;
  onNotesChange: (notes: string) => void;
  notesSaving: boolean;
  notesSaved: boolean;
  onDraftWithAI?: () => void;
  draftingNote: boolean;

  // DDx
  ddxDiagnoses: DiagnosisItem[];
  ddxLoading: boolean;
  onGenerateDdx: () => void;

  // Quick actions
  departments: DepartmentInfo[];
  onDischarge: () => void;
  onTransfer: (dept: string) => void;
  onSaveNotes: () => void;
  onEndShift: () => void;
}

function loadCollapsedPanels(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsedPanels(panels: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...panels]));
  } catch {
    // localStorage unavailable
  }
}

export function ClinicalWorkspace(props: ClinicalWorkspaceProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsedPanels());

  // Persist collapse state
  useEffect(() => {
    saveCollapsedPanels(collapsed);
  }, [collapsed]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hasPatient = !!props.patient;

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Scrollable panels */}
      <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 space-y-3">
        {/* Patient Card */}
        <CollapsiblePanel
          id="patient"
          title="Patient"
          icon={User}
          collapsed={collapsed.has("patient")}
          onToggle={() => toggle("patient")}
        >
          <PatientCardPanel
            patient={props.patient}
            selectedVisit={props.selectedVisit ?? null}
            visitBrief={props.visitBrief}
            briefLoading={props.briefLoading}
          />
        </CollapsiblePanel>

        {/* Clinical Notes */}
        <CollapsiblePanel
          id="notes"
          title="Clinical Notes"
          icon={FileEdit}
          collapsed={collapsed.has("notes")}
          onToggle={() => toggle("notes")}
        >
          <ClinicalNotesEditor
            notes={props.clinicalNotes}
            onChange={props.onNotesChange}
            saving={props.notesSaving}
            saved={props.notesSaved}
            disabled={!hasPatient}
            onDraftWithAI={props.onDraftWithAI}
            drafting={props.draftingNote}
            visitId={props.selectedVisit?.id}
          />
        </CollapsiblePanel>

        {/* Differential Diagnosis */}
        <CollapsiblePanel
          id="ddx"
          title="Differential Diagnosis"
          icon={Brain}
          iconColor="text-violet-600"
          collapsed={collapsed.has("ddx")}
          onToggle={() => toggle("ddx")}
        >
          <DdxPanel
            diagnoses={props.ddxDiagnoses}
            loading={props.ddxLoading}
            onGenerate={props.onGenerateDdx}
            disabled={!hasPatient}
            chiefComplaint={props.selectedVisit?.chief_complaint || undefined}
          />
        </CollapsiblePanel>
      </div>
      </ScrollArea>

      {/* Quick Actions — sticky at bottom */}
      <QuickActionsBar
        onDischarge={props.onDischarge}
        onTransfer={props.onTransfer}
        onSaveNotes={props.onSaveNotes}
        onEndShift={props.onEndShift}
        departments={props.departments}
        disabled={!hasPatient}
      />
    </div>
  );
}
