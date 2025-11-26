"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  getPatient,
  getSessionMessages,
  regenerateHealthSummary,
  deleteImagingRecord,
  type MedicalRecord,
  type Imaging,
  type ImageGroup,
} from "@/lib/api";
import { getMockPatientById, type PatientWithDetails } from "@/lib/mock-data";
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
import { MessageRole } from "@/types/enums";
import type { Message, AgentActivity } from "@/types/agent-ui";

export default function PatientDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [patient, setPatient] = useState<PatientWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiOpen, setAiOpen] = useState(!!sessionId); // Auto-open if session exists
  const [aiWidth, setAiWidth] = useState(400); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(
    null
  );
  const [activityDetails, setActivityDetails] = useState<string>("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(!!sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionIdRef = useRef<string | null>(sessionId);

  // Health summary regeneration
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaultGroupId, setUploadDefaultGroupId] = useState<
    string | undefined
  >(undefined);
  const [viewerRecord, setViewerRecord] = useState<
    MedicalRecord | Imaging | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Imaging | null>(null);
  const [isDeletingImaging, setIsDeletingImaging] = useState(false);

  useEffect(() => {
    if (params.id) {
      getPatient(Number(params.id))
        .then(setPatient)
        .catch(() => {
          const mockPatient = getMockPatientById(Number(params.id));
          if (mockPatient) {
            setPatient(mockPatient);
          }
        });
    }
  }, [params.id]);

  // Load session messages if session ID is provided
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      try {
        setLoadingSession(true);
        const sessionMessages = await getSessionMessages(parseInt(sessionId));

        // Convert to Message format
        const convertedMessages: Message[] = sessionMessages.map((msg) => ({
          id: msg.id.toString(),
          role: msg.role as MessageRole,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : undefined,
          reasoning: msg.reasoning || undefined,
          patientReferences: msg.patient_references
            ? JSON.parse(msg.patient_references)
            : undefined,
        }));

        setMessages(convertedMessages);
        sessionIdRef.current = sessionId;
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !patient || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Preparing to process your request");

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: MessageRole.ASSISTANT,
      content: "",
      timestamp: new Date(),
      toolCalls: [],
      reasoning: "",
      logs: [],
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          patient_id: patient.id,
          stream: true,
          session_id: sessionIdRef.current
            ? parseInt(sessionIdRef.current)
            : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulatedContent = "";
      const wordBuffer: string[] = [];
      let isProcessing = false;

      const displayWords = async () => {
        if (isProcessing) return;
        isProcessing = true;

        while (wordBuffer.length > 0) {
          const word = wordBuffer.shift();
          if (word !== undefined) {
            accumulatedContent += word;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
        }
        isProcessing = false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await displayWords();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);

              // Handle iteration events (autonomous ReAct loop)
              if (parsed.iteration) {
                const phase = parsed.phase;
                const iteration = parsed.iteration;

                if (phase === "thinking") {
                  setCurrentActivity("thinking");
                  setActivityDetails(
                    `Step ${iteration}: Planning next actions`
                  );
                } else if (phase === "acting") {
                  setCurrentActivity("tool_calling");
                  const toolCount = parsed.tool_count || 0;
                  setActivityDetails(
                    `Step ${iteration}: Running ${toolCount} tool${
                      toolCount > 1 ? "s" : ""
                    }`
                  );
                } else if (phase === "observing") {
                  setCurrentActivity("analyzing");
                  setActivityDetails(`Step ${iteration}: Reviewing results`);
                } else if (phase === "answering") {
                  setCurrentActivity("thinking");
                  setActivityDetails(`Step ${iteration}: Preparing answer`);
                }
              }

              if (parsed.chunk) {
                const words = parsed.chunk.match(/(\S+|\s+)/g) || [];
                wordBuffer.push(...words);
                setCurrentActivity(null);
                displayWords();
              }

              if (parsed.tool_call) {
                const toolCallData = parsed.tool_call;
                setCurrentActivity("tool_calling");
                setActivityDetails(`Using ${toolCallData.tool}`);
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMessageId) {
                      const existingTools = msg.toolCalls || [];
                      if (
                        !existingTools.find((t) => t.id === toolCallData.id)
                      ) {
                        return {
                          ...msg,
                          toolCalls: [
                            ...existingTools,
                            {
                              id: toolCallData.id,
                              tool: toolCallData.tool,
                              args: toolCallData.args,
                            },
                          ],
                        };
                      }
                    }
                    return msg;
                  })
                );
              }

              if (parsed.tool_result) {
                const toolResultData = parsed.tool_result;
                setCurrentActivity("analyzing");
                setActivityDetails("Processing results");
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMessageId && msg.toolCalls) {
                      return {
                        ...msg,
                        toolCalls: msg.toolCalls.map((t) =>
                          t.id === toolResultData.id
                            ? { ...t, result: toolResultData.result }
                            : t
                        ),
                      };
                    }
                    return msg;
                  })
                );
              }

              if (parsed.reasoning) {
                setCurrentActivity("thinking");
                setActivityDetails("Formulating response");
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          reasoning: (msg.reasoning || "") + parsed.reasoning,
                        }
                      : msg
                  )
                );
              }

              if (parsed.log) {
                const logItem = parsed.log;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, logs: [...(msg.logs || []), logItem] }
                      : msg
                  )
                );
              }

              if (parsed.patient_references) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, patientReferences: parsed.patient_references }
                      : msg
                  )
                );
              }

              if (parsed.done) break;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content:
                  msg.content +
                  "\n\n⚠️ Connection error. Please check if the backend server is running.",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setCurrentActivity(null);
      setActivityDetails("");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput("");
    await sendMessage(content);
  };

  const handleUploadComplete = (record: MedicalRecord | Imaging) => {
    setPatient((current) => {
      if (!current) return current;

      if ("image_type" in record) {
        // It's an Imaging record
        return {
          ...current,
          imaging: [record as Imaging, ...(current.imaging || [])],
        };
      }

      return {
        ...current,
        records: [record as MedicalRecord, ...(current.records || [])],
      };
    });
  };

  const handleImageGroupCreated = (group: ImageGroup) => {
    setPatient((current) => {
      if (!current) return current;
      const existingGroups = current.image_groups || [];
      if (existingGroups.some((g) => g.id === group.id)) {
        return current;
      }

      return {
        ...current,
        image_groups: [group, ...existingGroups],
      };
    });
  };

  const handleRegenerateHealthSummary = async () => {
    if (!patient || isRegenerating) return;

    setIsRegenerating(true);
    try {
      const response = await regenerateHealthSummary(patient.id);
      setPatient({
        ...patient,
        health_summary: response.health_summary,
        health_summary_updated_at: response.health_summary_updated_at,
      });
    } catch (error) {
      console.error("Failed to regenerate health summary:", error);
    } finally {
      setIsRegenerating(false);
    }
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
        imaging: (patient.imaging || []).filter(
          (img) => img.id !== pendingDelete.id
        ),
      });
      setViewerRecord((current) =>
        current && "image_type" in current && current.id === pendingDelete.id
          ? null
          : current
      );
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    } catch (error) {
      console.error("Failed to delete imaging record:", error);
    } finally {
      setIsDeletingImaging(false);
    }
  };

  const handleAnalyzeGroup = ({
    groupName,
    images,
  }: {
    groupId: string;
    groupName: string;
    images: Imaging[];
  }) => {
    if (!images.length) return;
    setAiOpen(true);
    const summaryList = images
      .slice(0, 5)
      .map((img) => `${img.title} (${img.image_type})`)
      .join(", ");
    const moreIndicator = images.length > 5 ? "..." : "";
    const message = `Analyze the imaging group "${groupName}" containing ${images.length} images: ${summaryList}${moreIndicator}`;
    sendMessage(message);
  };

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading patient...
        </div>
      </div>
    );
  }

  const imageRecords = patient.imaging || [];

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
          setUploadOpen={setUploadOpen}
        />

        {/* Tabs Content */}
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
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0">
                <HealthOverview
                  patient={patient}
                  onRegenerateClick={handleRegenerateHealthSummary}
                  isRegenerating={isRegenerating}
                  healthSummaryUpdatedAt={patient.health_summary_updated_at}
                />
              </TabsContent>

              {/* Medical Records Tab */}
              <TabsContent value="records" className="mt-0">
                <div className="mb-6">
                  <h2 className="font-display text-xl font-semibold">
                    Clinical Documentation
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete medical records including registration, encounters,
                    and laboratory results
                  </p>
                </div>
                <MedicalRecordsList records={patient.records || []} />
              </TabsContent>

              {/* Imaging Tab */}
              <TabsContent value="imaging" className="mt-0">
                <PatientImagingTab
                  imageRecords={imageRecords}
                  imageGroups={patient.image_groups}
                  setUploadOpen={setUploadOpen}
                  setUploadDefaultGroupId={setUploadDefaultGroupId}
                  setViewerRecord={setViewerRecord}
                  onAnalyzeGroup={handleAnalyzeGroup}
                />
              </TabsContent>

              {/* Lab Results Tab */}
              <TabsContent value="labs" className="mt-0">
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="p-4 rounded-full bg-muted/50">
                    <Clock className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      The Lab Results module is currently under development.
                      Check back later for updates.
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
        messages={messages}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        currentActivity={currentActivity}
        activityDetails={activityDetails}
        loadingSession={loadingSession}
        handleSendMessage={handleSendMessage}
        messagesEndRef={messagesEndRef}
        patient={patient}
        activeTab={activeTab}
        sessionId={sessionId}
        onClearChat={() => setMessages([])}
      />

      {/* Modals */}
      <RecordUpload
        patientId={patient.id}
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setUploadDefaultGroupId(undefined);
        }}
        onUploadComplete={handleUploadComplete}
        defaultGroupId={uploadDefaultGroupId}
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
              <span className="font-medium">
                {pendingDelete?.title ?? "this image"}
              </span>{" "}
              from the patient&apos;s imaging history. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingImaging}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={confirmDeleteImaging}
                disabled={isDeletingImaging}
              >
                {isDeletingImaging && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
