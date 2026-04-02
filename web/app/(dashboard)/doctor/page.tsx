"use client";

import { useEffect, useState } from "react";
import { useDoctorWorkspace } from "./use-doctor-workspace";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { PatientListPanel } from "@/components/doctor/patient-list-panel";
import { ClinicalWorkspace } from "@/components/doctor/clinical-workspace";
import { DoctorAiPanel } from "@/components/doctor/doctor-ai-panel";
import { ShiftHandoffModal } from "@/components/doctor/shift-handoff-modal";
import { ToastNotification } from "@/components/notifications/toast-notification";
import { useAuth } from "@/lib/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotifications } from "@/hooks/use-notifications";
import { listDepartments, type DepartmentInfo } from "@/lib/api";
import type { WSEvent } from "@/lib/ws-events";

export default function DoctorPage() {
  const workspace = useDoctorWorkspace();
  const { token, user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [wsEvents, setWsEvents] = useState<WSEvent[]>([]);

  // WebSocket connection
  const { subscribe, connected } = useWebSocket(token);
  const { bellItems, toasts, unreadCount, dismissToast, markAllRead, clearBellItem } =
    useNotifications(subscribe);

  // Collect WS events for child components
  useEffect(() => {
    return subscribe("*", (event) => {
      setWsEvents((prev) => [...prev.slice(-100), event]);
    });
  }, [subscribe]);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  // Split patients: mine vs waiting room
  const myPatients = workspace.queueVisits.filter(
    (v) => v.assigned_doctor === user?.name,
  );
  const waitingRoom = workspace.queueVisits.filter(
    (v) => !v.assigned_doctor || v.assigned_doctor !== user?.name,
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <DoctorHeader
        searchQuery={workspace.searchQuery}
        searchResults={workspace.searchResults}
        searchLoading={workspace.searchLoading}
        onSearch={workspace.handleSearch}
        onSelectPatient={(patient) => {
          const visit = workspace.queueVisits.find(
            (v) => v.patient_id === patient.id,
          );
          if (visit) workspace.selectVisit(visit);
        }}
        selectedPatientName={workspace.selectedPatient?.name}
        bellItems={bellItems}
        unreadCount={unreadCount}
        onMarkRead={markAllRead}
        onClearBell={clearBellItem}
      />

      {/* 3-Zone Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0 w-full">
        {/* Zone A: Patient List */}
        <div className="w-80 shrink-0 overflow-hidden">
          <PatientListPanel
            myPatients={myPatients}
            waitingRoom={waitingRoom}
            loading={workspace.queueLoading}
            selectedVisitId={workspace.selectedVisit?.id ?? null}
            onSelectVisit={workspace.selectVisit}
            wsEvents={wsEvents}
          />
        </div>

        {/* Zone B: Clinical Workspace */}
        <ClinicalWorkspace
          patient={workspace.selectedPatient}
          selectedVisit={workspace.selectedVisit}
          visitBrief={workspace.visitBrief}
          briefLoading={workspace.briefLoading}
          clinicalNotes={workspace.clinicalNotes}
          onNotesChange={workspace.handleNotesChange}
          notesSaving={workspace.notesSaving}
          notesSaved={workspace.notesSaved}
          onDraftWithAI={workspace.draftSoapNote}
          draftingNote={workspace.draftingNote}
          ddxDiagnoses={workspace.ddxDiagnoses}
          ddxLoading={workspace.ddxLoading}
          onGenerateDdx={workspace.generateDdx}
          departments={departments}
          onDischarge={workspace.handleDischarge}
          onTransfer={workspace.handleTransfer}
          onSaveNotes={() => {}}
          onEndShift={workspace.openShiftHandoff}
        />

        {/* Zone C: AI Assistant */}
        <DoctorAiPanel
          messages={workspace.chatMessages}
          input={workspace.chatInput}
          setInput={workspace.setChatInput}
          isLoading={workspace.chatLoading}
          currentActivity={workspace.currentActivity}
          activityDetails={workspace.activityDetails}
          handleSendMessage={workspace.handleChatSubmit}
          messagesEndRef={workspace.messagesEndRef}
          wsEvents={wsEvents}
          patientName={workspace.selectedPatient?.name}
          width={workspace.aiWidth}
          setWidth={workspace.setAiWidth}
          isResizing={workspace.isResizing}
          setIsResizing={workspace.setIsResizing}
          onResetChat={workspace.handleResetChat}
        />
      </div>

      {/* Toast notifications */}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />

      {/* Shift Handoff Modal */}
      <ShiftHandoffModal
        open={workspace.handoffOpen}
        onClose={() => workspace.setHandoffOpen(false)}
        content={workspace.handoffDoc}
        patientCount={workspace.handoffCount}
        loading={workspace.handoffLoading}
      />
    </div>
  );
}
