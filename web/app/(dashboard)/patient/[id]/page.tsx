"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  getPatient,
  getImageGroups,
  deleteImagingRecord,
  type MedicalRecord,
  type Imaging,
  type ImageGroup,
} from "@/lib/api";
import { getMockPatientById, type PatientWithDetails } from "@/lib/mock-data";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordUpload } from "@/components/medical/record-upload";
import { RecordViewer } from "@/components/medical/record-viewer";
import { HealthOverview } from "@/components/medical/health-overview";
import { MedicalRecordsList } from "@/components/medical/medical-records-list";
import { PatientHeader } from "@/components/patient/patient-header";
import { PatientImagingTab } from "@/components/medical/patient-imaging-tab";
import { AiAssistantPanel } from "@/components/patient/ai-assistant-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { usePatientChat } from "./use-patient-chat";

export default function PatientDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [patient, setPatient] = useState<PatientWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiOpen, setAiOpen] = useState(!!sessionId);
  const [aiWidth, setAiWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerRecord, setViewerRecord] = useState<MedicalRecord | Imaging | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Imaging | null>(null);
  const [isDeletingImaging, setIsDeletingImaging] = useState(false);

  const chat = usePatientChat(sessionId, patient?.id ?? null);

  useEffect(() => {
    if (params.id) {
      const patientId = Number(params.id);
      Promise.all([getPatient(patientId), getImageGroups(patientId)])
        .then(([patientData, imageGroupsData]) => {
          setPatient({ ...patientData, image_groups: imageGroupsData });
        })
        .catch(() => {
          const mockPatient = getMockPatientById(patientId);
          if (mockPatient) setPatient(mockPatient);
        });
    }
  }, [params.id]);

  const handleUploadComplete = (record: MedicalRecord | Imaging) => {
    setPatient((current) => {
      if (!current) return current;
      if ("image_type" in record) {
        return { ...current, imaging: [record as Imaging, ...(current.imaging || [])] };
      }
      return { ...current, records: [record as MedicalRecord, ...(current.records || [])] };
    });
  };

  const handleImageGroupCreated = (group: ImageGroup) => {
    setPatient((current) => {
      if (!current) return current;
      const existingGroups = current.image_groups || [];
      if (existingGroups.some((g) => g.id === group.id)) return current;
      return { ...current, image_groups: [group, ...existingGroups] };
    });
  };

  const handleDeleteImaging = (record: Imaging) => {
    setPendingDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteImaging = async () => {
    if (!patient || !pendingDelete) return;
    setIsDeletingImaging(true);
    try {
      await deleteImagingRecord(patient.id, pendingDelete.id);
      setPatient({
        ...patient,
        imaging: (patient.imaging || []).filter((img) => img.id !== pendingDelete.id),
      });
      setViewerRecord((current) =>
        current && "image_type" in current && current.id === pendingDelete.id ? null : current
      );
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete imaging record");
    } finally {
      setIsDeletingImaging(false);
    }
  };

  const handleAnalyzeGroup = ({ groupName, images }: { groupName: string; images: Imaging[] }) => {
    if (!images.length || !patient) return;
    setAiOpen(true);
    const summaryList = images
      .slice(0, 5)
      .map((img) => `${img.title} (${img.image_type})`)
      .join(", ");
    const moreIndicator = images.length > 5 ? "..." : "";
    const message = `Patient: ${patient.name} (ID: ${patient.id})\n\nAnalyze the imaging group "${groupName}" containing ${images.length} images: ${summaryList}${moreIndicator}`;
    chat.sendMessage(message);
  };

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading patient...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex">
      {/* Main Content */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ width: aiOpen ? `calc(100% - ${aiWidth}px)` : "100%" }}
      >
        <PatientHeader
          patient={patient}
          sessionId={sessionId}
          aiOpen={aiOpen}
          setAiOpen={setAiOpen}
        />

        <div className="container mx-auto p-6 flex-1 flex flex-col min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            <TabsList className="grid w-full grid-cols-4 mb-6 shrink-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="records">Medical Records</TabsTrigger>
              <TabsTrigger value="imaging">Imaging</TabsTrigger>
              <TabsTrigger value="labs">Lab Results</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 pr-1">
              <TabsContent value="overview" className="mt-0">
                <HealthOverview patient={patient} />
              </TabsContent>

              <TabsContent value="records" className="mt-0">
                <div className="mb-6">
                  <h2 className="font-display text-xl font-semibold">Clinical Documentation</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete medical records including registration, encounters, and laboratory results
                  </p>
                </div>
                <MedicalRecordsList records={patient.records || []} />
              </TabsContent>

              <TabsContent value="imaging" className="mt-0">
                <PatientImagingTab
                  patientId={patient.id}
                  imageRecords={patient.imaging || []}
                  imageGroups={patient.image_groups}
                  setUploadOpen={setUploadOpen}
                  setViewerRecord={setViewerRecord}
                  onAnalyzeGroup={handleAnalyzeGroup}
                />
              </TabsContent>

              <TabsContent value="labs" className="mt-0">
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="p-4 rounded-full bg-muted/50">
                    <Clock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      The Lab Results module is currently under development. Check back later for updates.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Resizable AI Assistant Panel */}
      <AiAssistantPanel
        aiOpen={aiOpen}
        aiWidth={aiWidth}
        setAiWidth={setAiWidth}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
        messages={chat.messages}
        input={chat.input}
        setInput={chat.setInput}
        isLoading={chat.isLoading}
        currentActivity={chat.currentActivity}
        activityDetails={chat.activityDetails}
        loadingSession={chat.loadingSession}
        handleSendMessage={chat.handleSendMessage}
        messagesEndRef={chat.messagesEndRef}
        patient={patient}
        activeTab={activeTab}
        sessionId={sessionId}
        onClearChat={chat.clearMessages}
      />

      {/* Modals */}
      <RecordUpload
        patientId={patient.id}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
        onGroupCreated={handleImageGroupCreated}
      />

      <RecordViewer
        record={viewerRecord}
        open={!!viewerRecord}
        onClose={() => setViewerRecord(null)}
        onDeleteImaging={handleDeleteImaging}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete imaging record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{pendingDelete?.title ?? "this image"}</span>{" "}
              from the patient&apos;s imaging history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingImaging}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={confirmDeleteImaging}
                disabled={isDeletingImaging}
              >
                {isDeletingImaging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
