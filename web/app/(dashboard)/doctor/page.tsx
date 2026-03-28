"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDoctorWorkspace } from "./use-doctor-workspace";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { ActivePatientsQueue } from "@/components/doctor/active-patients-queue";
import { ClinicalNotesEditor } from "@/components/doctor/clinical-notes-editor";
import { QuickActionsBar } from "@/components/doctor/quick-actions-bar";
import { DoctorAiPanel } from "@/components/doctor/doctor-ai-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExternalLink, User } from "lucide-react";
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

            <TabsContent value="patient" className="h-full m-0">
              <div className="h-full flex flex-col items-center justify-center gap-6 p-6">
                {workspace.selectedPatient ? (
                  <>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <User className="w-7 h-7 text-cyan-500" />
                      </div>
                      <h3 className="font-display text-lg font-semibold">
                        {workspace.selectedPatient.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        DOB: {workspace.selectedPatient.dob} &middot; {workspace.selectedPatient.gender} &middot; ID: {workspace.selectedPatient.id}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/patient/${workspace.selectedPatient.id}`} target="_blank">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Full Record
                      </Link>
                    </Button>
                    {workspace.selectedVisit && (
                      <QuickActionsBar
                        onDischarge={workspace.handleDischarge}
                        onTransfer={workspace.handleTransfer}
                        onSaveNotes={() => {}}
                        departments={departments}
                        disabled={!workspace.selectedVisit}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a patient from the queue</p>
                )}
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
        width={workspace.aiWidth}
        setWidth={workspace.setAiWidth}
        isResizing={workspace.isResizing}
        setIsResizing={workspace.setIsResizing}
      />
    </div>
  );
}
