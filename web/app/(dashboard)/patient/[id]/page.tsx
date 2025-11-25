"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getPatient, getSessionMessages, type Patient, type MedicalRecord, type PatientVisit } from "@/lib/api";
import { getMockPatientById, type PatientWithDetails } from "@/lib/mock-data";
import { MessageRole } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  Calendar,
  ChevronLeft,
  Upload,
  Sparkles,
  Send,
  GripVertical,
  FileText,
  Image as ImageIcon,
  Activity,
  Stethoscope,
  FileHeart,
  Scan,
  Plus,
  History,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RecordUpload } from "@/components/medical/record-upload";
import { RecordViewer } from "@/components/medical/record-viewer";
import { TextRecordEditor } from "@/components/medical/text-record-editor";
import { HealthOverview } from "@/components/medical/health-overview";
import { VisitDetailViewer } from "@/components/medical/visit-detail-viewer";
import { FilterableList } from "@/components/medical/filterable-list";
import { MedicalRecordsList } from "@/components/medical/medical-records-list";

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [patient, setPatient] = useState<PatientWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiOpen, setAiOpen] = useState(!!sessionId); // Auto-open if session exists
  const [aiWidth, setAiWidth] = useState(400); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(!!sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [viewerRecord, setViewerRecord] = useState<MedicalRecord | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisit | null>(null);

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

        // Convert to patient detail AI panel message format
        const convertedMessages = sessionMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
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

  // Resizable panel logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setAiWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !patient) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          patient_id: patient.id,
          stream: true,
          session_id: sessionIdRef.current ? parseInt(sessionIdRef.current) : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) return;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    lastMessage.content += data.chunk;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection error. Please check if the backend server is running." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = (record: MedicalRecord) => {
    if (patient) {
      setPatient({
        ...patient,
        records: [record, ...(patient.records || [])],
      });
    }
  };

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading patient...</div>
      </div>
    );
  }

  const visits = patient.visits || [];
  const imageRecords = patient.records?.filter((r) => r.record_type === "image") || [];
  const pdfRecords = patient.records?.filter((r) => r.record_type === "pdf") || [];

  return (
    <div className="h-full bg-background flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col" style={{ width: aiOpen ? `calc(100% - ${aiWidth}px)` : "100%" }}>
        {/* Header */}
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (sessionId) {
                      router.push(`/agent?session=${sessionId}`);
                    } else {
                      router.push("/patient");
                    }
                  }}
                  className="hover:bg-cyan-500/10"
                  title={sessionId ? "Back to Chat" : "Back to Patients"}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <div>
                  {sessionId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="text-cyan-500 cursor-pointer hover:underline" onClick={() => router.push(`/agent?session=${sessionId}`)}>
                        Agent Chat
                      </span>
                      <span>/</span>
                      <span>Patient: {patient.name}</span>
                    </div>
                  )}
                  <h1 className="font-display text-2xl font-bold flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
                    {patient.name}
                  </h1>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {patient.gender}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      DOB: {patient.dob}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <Badge variant="secondary" className="medical-badge-text">
                      ID: #{patient.id}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setUploadOpen(true)}
                  className="secondary-button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <Button
                  onClick={() => setAiOpen(!aiOpen)}
                  className={aiOpen ? "secondary-button" : "primary-button"}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {aiOpen ? "Close AI" : "AI Assistant"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="records">Medical Records</TabsTrigger>
                <TabsTrigger value="visits">Visits</TabsTrigger>
                <TabsTrigger value="labs">Lab Results</TabsTrigger>
                <TabsTrigger value="imaging">Imaging</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <HealthOverview patient={patient} />
              </TabsContent>

              {/* Medical Records Tab */}
              <TabsContent value="records">
                <div className="mb-6">
                  <h2 className="font-display text-xl font-semibold">Clinical Documentation</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete medical records including registration, encounters, and laboratory results
                  </p>
                </div>
                <MedicalRecordsList records={patient.records || []} />
              </TabsContent>

              {/* Clinical Notes / Visits Tab */}
              <TabsContent value="visits">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold">Patient Visits</h2>
                  <Button onClick={() => setTextEditorOpen(true)} className="primary-button">
                    <Plus className="w-4 h-4 mr-2" />
                    New Visit Note
                  </Button>
                </div>

                <FilterableList
                  items={visits}
                  searchFields={["chief_complaint", "diagnosis", "doctor_name", "notes"]}
                  filterOptions={[
                    {
                      label: "Visit Type",
                      field: "visit_type",
                      options: [
                        { value: "all", label: "All Types" },
                        { value: "routine", label: "Routine" },
                        { value: "emergency", label: "Emergency" },
                        { value: "follow-up", label: "Follow-up" },
                        { value: "consultation", label: "Consultation" },
                      ],
                    },
                    {
                      label: "Status",
                      field: "status",
                      options: [
                        { value: "all", label: "All Statuses" },
                        { value: "completed", label: "Completed" },
                        { value: "scheduled", label: "Scheduled" },
                        { value: "cancelled", label: "Cancelled" },
                      ],
                    },
                  ]}
                  sortOptions={[
                    {
                      value: "recent",
                      label: "Most Recent",
                      compareFn: (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime(),
                    },
                    {
                      value: "oldest",
                      label: "Oldest First",
                      compareFn: (a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime(),
                    },
                  ]}
                  renderGridItem={(visit) => (
                    <button onClick={() => setSelectedVisit(visit)} className="text-left w-full">
                      <Card className="record-card group p-4 h-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                              <Stethoscope className="w-4 h-4 text-cyan-500" />
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                visit.visit_type === "emergency"
                                  ? "bg-red-500/10 text-red-500 border-red-500/30"
                                  : "medical-badge-text"
                              }
                            >
                              {visit.visit_type}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(visit.visit_date).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-display font-semibold mb-1.5 group-hover:text-cyan-500 transition-colors">
                          {visit.chief_complaint}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {visit.diagnosis}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {visit.doctor_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              visit.status === "completed"
                                ? "bg-green-500/10 text-green-500 border-green-500/30"
                                : "medical-badge-text"
                            }
                          >
                            {visit.status}
                          </Badge>
                        </div>
                      </Card>
                    </button>
                  )}
                  renderListItem={(visit) => (
                    <button onClick={() => setSelectedVisit(visit)} className="text-left w-full">
                      <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-cyan-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                                {visit.chief_complaint}
                              </h3>
                              <Badge variant="secondary" className="medical-badge-text flex-shrink-0">
                                {visit.visit_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate mb-1">
                              {visit.diagnosis}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(visit.visit_date).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {visit.doctor_name}
                              </span>
                              <Badge
                                variant="secondary"
                                className={
                                  visit.status === "completed"
                                    ? "bg-green-500/10 text-green-500 border-green-500/30"
                                    : ""
                                }
                              >
                                {visit.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  )}
                  emptyMessage="No visits found"
                />
              </TabsContent>

              {/* Lab Results Tab */}
              <TabsContent value="labs">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold">Lab Results</h2>
                  <Button onClick={() => setUploadOpen(true)} className="primary-button">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Lab Report
                  </Button>
                </div>

                <FilterableList
                  items={pdfRecords}
                  searchFields={["title", "description"]}
                  filterOptions={[
                    {
                      label: "Report Type",
                      field: "file_type",
                      options: [
                        { value: "all", label: "All Types" },
                        { value: "lab_report", label: "Lab Report" },
                        { value: "other", label: "Other" },
                      ],
                    },
                  ]}
                  sortOptions={[
                    {
                      value: "recent",
                      label: "Most Recent",
                      compareFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                    },
                    {
                      value: "oldest",
                      label: "Oldest First",
                      compareFn: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                    },
                    {
                      value: "name",
                      label: "Name (A-Z)",
                      compareFn: (a, b) => a.title.localeCompare(b.title),
                    },
                  ]}
                  renderGridItem={(record) => (
                    <button onClick={() => setViewerRecord(record)} className="text-left w-full">
                      <Card className="record-card group p-4 h-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                            <FileHeart className="w-5 h-5 text-teal-500" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
                          {record.title}
                        </h3>
                        {record.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {record.description}
                          </p>
                        )}
                      </Card>
                    </button>
                  )}
                  renderListItem={(record) => (
                    <button onClick={() => setViewerRecord(record)} className="text-left w-full">
                      <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors flex-shrink-0">
                            <FileHeart className="w-5 h-5 text-teal-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                              {record.title}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {record.description || "No description"}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(record.created_at).toLocaleDateString()}
                              </span>
                              <Badge variant="secondary" className="medical-badge-text">
                                {record.file_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  )}
                  emptyMessage="No lab results found"
                />
              </TabsContent>

              {/* Imaging Tab */}
              <TabsContent value="imaging">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold">Medical Imaging</h2>
                  <Button onClick={() => setUploadOpen(true)} className="primary-button">
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Upload Image
                  </Button>
                </div>

                <FilterableList
                  items={imageRecords}
                  searchFields={["title", "description"]}
                  filterOptions={[
                    {
                      label: "Imaging Type",
                      field: "file_type",
                      options: [
                        { value: "all", label: "All Types" },
                        { value: "mri", label: "MRI" },
                        { value: "xray", label: "X-Ray" },
                        { value: "ct_scan", label: "CT Scan" },
                        { value: "ultrasound", label: "Ultrasound" },
                      ],
                    },
                  ]}
                  sortOptions={[
                    {
                      value: "recent",
                      label: "Most Recent",
                      compareFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                    },
                    {
                      value: "oldest",
                      label: "Oldest First",
                      compareFn: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                    },
                    {
                      value: "name",
                      label: "Name (A-Z)",
                      compareFn: (a, b) => a.title.localeCompare(b.title),
                    },
                  ]}
                  renderGridItem={(record) => (
                    <button onClick={() => setViewerRecord(record)} className="text-left w-full">
                      <Card className="record-card group p-4 h-full">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                            <Scan className="w-5 h-5 text-purple-500" />
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              record.file_type === "mri"
                                ? "medical-badge-mri"
                                : record.file_type === "xray"
                                ? "medical-badge-xray"
                                : "medical-badge-text"
                            }
                          >
                            {record.file_type?.toUpperCase()}
                          </Badge>
                        </div>
                        <h3 className="font-display font-semibold mb-2 group-hover:text-cyan-500 transition-colors">
                          {record.title}
                        </h3>
                        {record.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {record.description}
                          </p>
                        )}
                        <div className="mt-3 text-xs text-muted-foreground">
                          {new Date(record.created_at).toLocaleDateString()}
                        </div>
                      </Card>
                    </button>
                  )}
                  renderListItem={(record) => (
                    <button onClick={() => setViewerRecord(record)} className="text-left w-full">
                      <Card className="record-card group p-4 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                            <Scan className="w-5 h-5 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-display font-semibold truncate group-hover:text-cyan-500 transition-colors">
                                {record.title}
                              </h3>
                              <Badge
                                variant="secondary"
                                className={
                                  record.file_type === "mri"
                                    ? "medical-badge-mri"
                                    : record.file_type === "xray"
                                    ? "medical-badge-xray"
                                    : "medical-badge-text"
                                }
                              >
                                {record.file_type?.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {record.description || "No description"}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(record.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
                  )}
                  emptyMessage="No imaging records found"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Resizable AI Assistant Panel */}
      {aiOpen && (
        <div
          className="relative border-l border-border/50 bg-card/30 backdrop-blur-xl flex flex-col"
          style={{ width: aiWidth }}
        >
          {/* Resize Handle */}
          <div
            ref={resizeRef}
            onMouseDown={() => setIsResizing(true)}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-cyan-500/50 transition-colors group"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-cyan-500" />
            </div>
          </div>

          {/* AI Header */}
          <div className="p-4 border-b border-border bg-gradient-to-r from-cyan-500/10 to-teal-500/10">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              AI Medical Assistant
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Context: {patient.name} • {activeTab}
            </p>
            {sessionId && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className="medical-badge-text text-xs">
                  <History className="w-3 h-3 mr-1" />
                  Continuing Chat Session
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/agent?session=${sessionId}`)}
                  className="text-xs h-6 px-2 hover:bg-cyan-500/10 hover:text-cyan-400"
                >
                  Back to Chat
                </Button>
              </div>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {loadingSession ? (
              <div className="text-center text-muted-foreground mt-10 space-y-4">
                <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                <div>
                  <p className="font-medium">Loading chat session...</p>
                </div>
              </div>
            ) : messages.length === 0 && (
              <div className="text-center text-muted-foreground mt-10 space-y-4">
                <div className="inline-flex p-4 rounded-full bg-cyan-500/10">
                  <Activity className="w-8 h-8 text-cyan-500" />
                </div>
                <div>
                  <p className="font-medium">AI Ready</p>
                  <p className="text-sm mt-2">Ask about {patient.name}'s medical records</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white"
                        : "bg-card border border-border"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-xl p-3">
                    <span className="animate-pulse text-cyan-500">Analyzing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about medical records..."
                className="flex-1 medical-input"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()} className="primary-button">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      <RecordUpload
        patientId={patient.id}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <TextRecordEditor
        patientId={patient.id}
        open={textEditorOpen}
        onClose={() => setTextEditorOpen(false)}
        onSave={handleUploadComplete}
      />

      <RecordViewer
        record={viewerRecord}
        open={!!viewerRecord}
        onClose={() => setViewerRecord(null)}
        onAnalyze={(record) => {
          setAiOpen(true);
          setInput(`Analyze the ${record.title}`);
        }}
      />

      <VisitDetailViewer
        visit={selectedVisit}
        records={patient.records}
        open={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        onRecordClick={(record) => {
          setSelectedVisit(null);
          setViewerRecord(record);
        }}
      />
    </div>
  );
}
