"use client";

import { useEffect, useState } from "react";
import { useDoctorWorkspace } from "./use-doctor-workspace";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { ActivePatientsQueue } from "@/components/doctor/active-patients-queue";
import { PatientSnapshot } from "@/components/doctor/patient-snapshot";
import { ClinicalNotesEditor } from "@/components/doctor/clinical-notes-editor";
import { QuickActionsBar } from "@/components/doctor/quick-actions-bar";
import { DoctorAiPanel } from "@/components/doctor/doctor-ai-panel";
import { DdxPanel } from "@/components/doctor/ddx-panel";
import { SpecialistConsultPanel } from "@/components/doctor/specialist-consult-panel";
import { OrdersPanel } from "@/components/doctor/orders-panel";
import { ShiftHandoffModal } from "@/components/doctor/shift-handoff-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listDepartments, type DepartmentInfo } from "@/lib/api";

export default function DoctorPage() {
  const workspace = useDoctorWorkspace();
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel — Patient Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header with search */}
        <DoctorHeader
          searchQuery={workspace.searchQuery}
          searchResults={workspace.searchResults}
          searchLoading={workspace.searchLoading}
          onSearch={workspace.handleSearch}
          onSelectPatient={(patient) => {
            // Find visit for this patient in the queue, or load patient directly
            const visit = workspace.queueVisits.find(
              (v) => v.patient_id === patient.id
            );
            if (visit) {
              workspace.selectVisit(visit);
            }
          }}
          selectedPatientName={workspace.selectedPatient?.name}
        />

        {/* Tabs */}
        <Tabs
          value={workspace.activeTab}
          onValueChange={(v) => workspace.setActiveTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b border-border px-6">
            <TabsList className="bg-transparent h-10 gap-2">
              <TabsTrigger
                value="queue"
                className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-500"
              >
                Active Queue
                {workspace.queueVisits.length > 0 && (
                  <span className="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">
                    {workspace.queueVisits.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="patient"
                className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-500"
                disabled={!workspace.selectedPatient}
              >
                Patient Detail
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-500"
                disabled={!workspace.selectedVisit}
              >
                Clinical Notes
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-500"
                disabled={!workspace.selectedVisit}
              >
                Orders
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="queue" className="h-full m-0">
              <ActivePatientsQueue
                visits={workspace.queueVisits}
                loading={workspace.queueLoading}
                onSelectVisit={workspace.selectVisit}
                onRefresh={workspace.refreshQueue}
              />
            </TabsContent>

            <TabsContent value="patient" className="h-full m-0 overflow-y-auto">
              <div className="p-6 space-y-4">
                <PatientSnapshot
                  patient={workspace.selectedPatient}
                  visit={workspace.selectedVisit}
                  loading={workspace.patientLoading}
                />
                {workspace.selectedVisit && (
                  <QuickActionsBar
                    onDischarge={workspace.handleDischarge}
                    onTransfer={workspace.handleTransfer}
                    onSaveNotes={() => {}}
                    departments={departments}
                    disabled={!workspace.selectedVisit}
                    onEndShift={workspace.openShiftHandoff}
                  />
                )}
                <DdxPanel
                  diagnoses={workspace.ddxDiagnoses}
                  loading={workspace.ddxLoading}
                  onGenerate={workspace.generateDdx}
                  disabled={!workspace.selectedVisit}
                  chiefComplaint={workspace.selectedVisit?.chief_complaint ?? undefined}
                />
                <SpecialistConsultPanel
                  specialists={workspace.specialists}
                  onConsult={workspace.consultSpecialist}
                  disabled={!workspace.selectedPatient}
                />
              </div>
            </TabsContent>

            <TabsContent value="notes" className="h-full m-0">
              <div className="p-6 h-full">
                <ClinicalNotesEditor
                  notes={workspace.clinicalNotes}
                  onChange={workspace.handleNotesChange}
                  saving={workspace.notesSaving}
                  saved={workspace.notesSaved}
                  disabled={!workspace.selectedVisit}
                  onDraftWithAI={workspace.draftSoapNote}
                  drafting={workspace.draftingNote}
                />
              </div>
            </TabsContent>

            <TabsContent value="orders" className="h-full m-0 overflow-y-auto">
              <div className="p-6">
                <OrdersPanel
                  orders={workspace.orders}
                  loading={workspace.ordersLoading}
                  onCreateOrder={workspace.handleCreateOrder}
                  disabled={!workspace.selectedPatient}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Right Panel — AI Chat */}
      <DoctorAiPanel
        messages={workspace.chatMessages}
        input={workspace.chatInput}
        setInput={workspace.setChatInput}
        isLoading={workspace.chatLoading}
        currentActivity={workspace.currentActivity}
        activityDetails={workspace.activityDetails}
        handleSendMessage={workspace.handleChatSubmit}
        messagesEndRef={workspace.messagesEndRef}
        patientName={workspace.selectedPatient?.name}
        visitBrief={workspace.visitBrief}
        briefLoading={workspace.briefLoading}
        width={workspace.aiWidth}
        setWidth={workspace.setAiWidth}
        isResizing={workspace.isResizing}
        setIsResizing={workspace.setIsResizing}
      />

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
