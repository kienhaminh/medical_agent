"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  listActiveVisits,
  getPatient,
  searchPatients,
  saveClinicalNotes,
  assignVisitDoctor,
  completeVisit,
  transferVisit,
  sendChatMessage,
  cancelMessage,
  streamMessageUpdates,
  getSessionMessages,
  getVisitBrief,
  getDifferentialDiagnosis,
  getShiftHandoff,
  type VisitListItem,
  type PatientDetail,
  type Patient,
  type StreamEvent,
  type DiagnosisItem,
  type ChatMessage as ApiChatMessage,
} from "@/lib/api";
import type { AgentActivity, ToolCall, LogItem, PatientReference } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const DOCTOR_SESSIONS_KEY = "medinexus_doctor_sessions";

function savePatientSession(patientId: number, sessionId: number): void {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[String(patientId)] = sessionId;
    localStorage.setItem(DOCTOR_SESSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function loadPatientSession(patientId: number): number | null {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    if (!raw) return null;
    const map: Record<string, number> = JSON.parse(raw);
    return map[String(patientId)] ?? null;
  } catch {
    return null;
  }
}

function clearPatientSession(patientId: number): void {
  try {
    const raw = localStorage.getItem(DOCTOR_SESSIONS_KEY);
    if (!raw) return;
    const map: Record<string, number> = JSON.parse(raw);
    delete map[String(patientId)];
    localStorage.setItem(DOCTOR_SESSIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function mapApiMessageToUi(msg: ApiChatMessage): Message {
  return {
    id: msg.id.toString(),
    role: msg.role === "user" ? MessageRole.USER : MessageRole.ASSISTANT,
    content: msg.content,
    timestamp: new Date(msg.created_at),
    status: msg.status,
    toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : [],
    reasoning: msg.reasoning ?? "",
    logs: msg.logs ? JSON.parse(msg.logs) : [],
    patientReferences: msg.patient_references ? JSON.parse(msg.patient_references) : [],
  };
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  logs?: LogItem[];
  patientReferences?: PatientReference[];
}

export type DoctorTab = "queue" | "patient" | "notes";

const POLL_INTERVAL = 30_000;

export function useDoctorWorkspace() {
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<DoctorTab>("queue");

  // Queue state
  const [queueVisits, setQueueVisits] = useState<VisitListItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // Patient state
  const [selectedVisit, setSelectedVisit] = useState<VisitListItem | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  // Pre-visit brief state
  const [visitBrief, setVisitBrief] = useState<string>("");
  const [briefLoading, setBriefLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Clinical notes state
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState("");
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const chatSessionIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const streamingMessageIdRef = useRef<number | null>(null);
  const selectVisitTokenRef = useRef(0);
  // Maps in-flight tool call id → tool name so tool_result can look up which tool completed
  const toolCallMapRef = useRef<Map<string, string>>(new Map());

  // Differential diagnosis state
  const [ddxDiagnoses, setDdxDiagnoses] = useState<DiagnosisItem[]>([]);
  const [ddxLoading, setDdxLoading] = useState(false);

  // SOAP draft state
  const [draftingNote, setDraftingNote] = useState(false);

  // Shift handoff state
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffDoc, setHandoffDoc] = useState("");
  const [handoffCount, setHandoffCount] = useState(0);
  const [handoffLoading, setHandoffLoading] = useState(false);


  // Fetch active visits queue — scoped to the doctor's department to avoid pagination limits
  const fetchQueue = useCallback(async () => {
    try {
      const visits = await listActiveVisits(user?.department ?? undefined);
      // Filter to in_department visits only
      const inDepartment = visits.filter((v) => v.status === "in_department");
      setQueueVisits(inDepartment);
    } catch {
      // Silently fail on poll
    } finally {
      setQueueLoading(false);
    }
  }, [user?.department]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Load patient when visit selected
  const selectVisit = useCallback(async (visit: VisitListItem) => {
    const token = ++selectVisitTokenRef.current;

    setSelectedVisit(visit);
    setActiveTab("patient");
    setPatientLoading(true);
    // Reset chat state before loading new patient
    setChatMessages([]);
    setChatSessionId(null);
    chatSessionIdRef.current = null;
    setVisitBrief("");
    setDdxDiagnoses([]);
    setDdxLoading(false);

    let patientLoadFailed = false;
    try {
      const patient = await getPatient(visit.patient_id);
      if (token !== selectVisitTokenRef.current) return;
      setSelectedPatient(patient);
      setClinicalNotes((visit as any).clinical_notes || "");
      setNotesSaved(false);
    } catch {
      toast.error("Failed to load patient details");
      patientLoadFailed = true;
    } finally {
      setPatientLoading(false);
    }

    // Don't restore session without a loaded patient
    if (patientLoadFailed) return;

    // Restore this patient's previous session if available
    const storedSessionId = loadPatientSession(visit.patient_id);
    if (storedSessionId) {
      try {
        const messages = await getSessionMessages(storedSessionId);
        if (token !== selectVisitTokenRef.current) return;
        const uiMessages = messages
          .filter((m) => m.content && m.content.trim())
          .map(mapApiMessageToUi);
        if (uiMessages.length > 0) {
          setChatMessages(uiMessages);
          chatSessionIdRef.current = storedSessionId;
          setChatSessionId(storedSessionId);
        }
      } catch {
        // Session expired or deleted on server — start fresh
        clearPatientSession(visit.patient_id);
      }
    }

    // Fetch pre-visit brief asynchronously after patient load
    if (token !== selectVisitTokenRef.current) return;
    setBriefLoading(true);
    getVisitBrief(visit.id)
      .then((data) => {
        if (token !== selectVisitTokenRef.current) return;
        setVisitBrief(data.brief);
      })
      .catch(() => setVisitBrief(""))
      .finally(() => setBriefLoading(false));
  }, []);

  // Patient search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPatients(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Auto-save clinical notes (debounced 2s)
  const handleNotesChange = useCallback(
    (notes: string) => {
      setClinicalNotes(notes);
      setNotesSaved(false);
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      if (!selectedVisit) return;
      notesTimerRef.current = setTimeout(async () => {
        setNotesSaving(true);
        try {
          await saveClinicalNotes(selectedVisit.id, notes);
          setNotesSaved(true);
        } catch {
          toast.error("Failed to save notes");
        } finally {
          setNotesSaving(false);
        }
      }, 2000);
    },
    [selectedVisit]
  );

  // Immediate save (clears debounce timer and saves now)
  const handleSaveNotes = useCallback(async () => {
    if (!selectedVisit) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    setNotesSaving(true);
    try {
      await saveClinicalNotes(selectedVisit.id, clinicalNotes);
      setNotesSaved(true);
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setNotesSaving(false);
    }
  }, [selectedVisit, clinicalNotes]);

  // Accept a waiting room patient — assigns the current doctor and opens the workspace
  const handleAcceptPatient = useCallback(
    async (visit: VisitListItem, currentDoctorName: string, myPatientsCount: number) => {
      if (myPatientsCount > 0) {
        toast.warning("Finish with your current patient before accepting a new one.");
        return;
      }
      try {
        await assignVisitDoctor(visit.id, currentDoctorName);
        toast.success(`Accepted ${visit.patient_name}`);
        await fetchQueue();
        await selectVisit(visit);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to accept patient");
      }
    },
    [fetchQueue, selectVisit]
  );

  // Quick actions
  const handleDischarge = useCallback(async () => {
    if (!selectedVisit) return;
    try {
      await completeVisit(selectedVisit.id);
      clearPatientSession(selectedVisit.patient_id);
      toast.success("Patient discharged");
      setSelectedVisit(null);
      setSelectedPatient(null);
      setActiveTab("queue");
      fetchQueue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to discharge");
    }
  }, [selectedVisit, fetchQueue]);

  const handleTransfer = useCallback(
    async (targetDepartment: string) => {
      if (!selectedVisit) return;
      try {
        await transferVisit(selectedVisit.id, targetDepartment);
        clearPatientSession(selectedVisit.patient_id);
        toast.success(`Patient transferred to ${targetDepartment}`);
        setSelectedVisit(null);
        setSelectedPatient(null);
        setActiveTab("queue");
        fetchQueue();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to transfer");
      }
    },
    [selectedVisit, fetchQueue]
  );

  // AI Chat functions
  function clearChatLoadingState() {
    setChatLoading(false);
    setCurrentActivity(null);
    setActivityDetails("");
    setDdxLoading(false);
    cancelStreamRef.current?.();
    cancelStreamRef.current = null;
    streamingMessageIdRef.current = null;
    toolCallMapRef.current.clear();
  }

  async function handleStopAgent() {
    const messageId = streamingMessageIdRef.current;
    clearChatLoadingState();
    if (messageId !== null) {
      try {
        await cancelMessage(messageId);
      } catch {
        // Best-effort — local state is already cleared
      }
    }
  }

  const handleResetChat = useCallback(() => {
    cancelStreamRef.current?.();
    cancelStreamRef.current = null;
    setChatMessages([]);
    setChatSessionId(null);
    chatSessionIdRef.current = null;
    clearChatLoadingState();
    if (selectedPatient) {
      clearPatientSession(selectedPatient.id);
    }
  }, [selectedPatient]);

  function handleStreamEvent(event: StreamEvent, messageId: string) {
    if (event.type === "chunk" || event.type === "content") {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: msg.content + event.content, status: "streaming" }
            : msg
        )
      );
    } else if (event.type === "status") {
      if (event.status === "streaming") {
        setCurrentActivity("thinking");
        setActivityDetails("Generating response...");
      }
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            status: event.status,
            content: event.content !== undefined ? event.content : msg.content,
            toolCalls: event.tool_calls ?? msg.toolCalls,
            reasoning: event.reasoning !== undefined ? event.reasoning : msg.reasoning,
            logs: event.logs ?? msg.logs,
            patientReferences: event.patient_references ?? msg.patientReferences,
          };
        })
      );
    } else if (event.type === "tool_call") {
      setCurrentActivity("tool_calling");
      setActivityDetails(`Using tool: ${event.tool}`);
      toolCallMapRef.current.set(event.id, event.tool);
      if (event.tool === "generate_differential_diagnosis") {
        setDdxLoading(true);
      }
      if (event.tool === "save_clinical_note" && event.args?.note_content) {
        setClinicalNotes(event.args.note_content as string);
        setNotesSaved(false);
      }
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, toolCalls: [...(msg.toolCalls ?? []), { id: event.id, tool: event.tool, args: event.args ?? {}, result: null }] }
            : msg
        )
      );
    } else if (event.type === "tool_result") {
      setCurrentActivity("analyzing");
      setActivityDetails("Processing tool result...");
      const toolName = toolCallMapRef.current.get(event.id);
      if (toolName === "generate_differential_diagnosis") {
        try {
          const parsed = JSON.parse(event.result);
          if (Array.isArray(parsed.diagnoses)) {
            setDdxDiagnoses(parsed.diagnoses);
          }
        } catch {}
        setDdxLoading(false);
        toolCallMapRef.current.delete(event.id);
      }
      if (toolName === "save_clinical_note") {
        setNotesSaved(true);
        toolCallMapRef.current.delete(event.id);
      }
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, toolCalls: (msg.toolCalls ?? []).map((tc) => tc.id === event.id ? { ...tc, result: event.result } : tc) }
            : msg
        )
      );
    } else if (event.type === "reasoning") {
      setCurrentActivity("thinking");
      setActivityDetails("Reasoning...");
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, reasoning: (msg.reasoning || "") + event.content }
            : msg
        )
      );
    } else if (event.type === "done") {
      clearChatLoadingState();
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, status: "completed" } : msg
        )
      );
    } else if (event.type === "error") {
      toast.error(event.message);
      clearChatLoadingState();
    }
  }

  const handleChatSubmit = async (message: string) => {
    if (!message.trim() || chatLoading) return;

    const userInput = message.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: userInput,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Submitting your request...");

    try {
      const response = await sendChatMessage({
        message: userInput,
        patient_id: selectedPatient?.id,
        visit_id: selectedVisit?.id,
        session_id: chatSessionIdRef.current,
      });

      if (!chatSessionIdRef.current) {
        chatSessionIdRef.current = response.session_id;
        setChatSessionId(response.session_id);
        if (selectedPatient) {
          savePatientSession(selectedPatient.id, response.session_id);
        }
      }

      const assistantMessage: Message = {
        id: response.message_id.toString(),
        role: MessageRole.ASSISTANT,
        content: "",
        timestamp: new Date(),
        status: response.status,
        toolCalls: [],
        reasoning: "",
        logs: [],
      };
      setChatMessages((prev) => [...prev, assistantMessage]);

      const cancel = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) => handleStreamEvent(event, response.message_id.toString()),
        () => clearChatLoadingState()
      );
      cancelStreamRef.current = cancel;
      streamingMessageIdRef.current = response.message_id;
    } catch {
      toast.error("Failed to send message");
      clearChatLoadingState();
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Generate differential diagnoses for the selected visit via the DDx endpoint
  const generateDdx = async () => {
    if (!selectedVisit) return;
    setDdxLoading(true);
    setDdxDiagnoses([]);
    try {
      const result = await getDifferentialDiagnosis(selectedVisit.id);
      setDdxDiagnoses(result.diagnoses);
    } catch (e) {
      console.error("DDx failed:", e);
      toast.error("Failed to generate differential diagnosis");
    } finally {
      setDdxLoading(false);
    }
  };

  // One-click SOAP draft — sends a standardized prompt to the Doctor AI
  const draftSoapNote = useCallback(async () => {
    if (!selectedPatient || !selectedVisit) return;
    setDraftingNote(true);

    const prompt = `Generate a SOAP clinical note for patient ${selectedPatient.name} (ID: ${selectedPatient.id}), visit ${selectedVisit.visit_id}. Chief complaint: ${selectedVisit.chief_complaint || "not recorded"}. Review the patient's medical records and current visit context. Format as:\n\n**S (Subjective):** ...\n**O (Objective):** ...\n**A (Assessment):** ...\n**P (Plan):** ...`;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: prompt,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Submitting your request...");

    try {
      const response = await sendChatMessage({
        message: prompt,
        patient_id: selectedPatient.id,
        visit_id: selectedVisit?.id,
        session_id: chatSessionIdRef.current,
      });

      if (!chatSessionIdRef.current) {
        chatSessionIdRef.current = response.session_id;
        setChatSessionId(response.session_id);
        if (selectedPatient) {
          savePatientSession(selectedPatient.id, response.session_id);
        }
      }

      const assistantMessage: Message = {
        id: response.message_id.toString(),
        role: MessageRole.ASSISTANT,
        content: "",
        timestamp: new Date(),
        status: response.status,
        toolCalls: [],
        reasoning: "",
        logs: [],
      };
      setChatMessages((prev) => [...prev, assistantMessage]);

      const cancel = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) => handleStreamEvent(event, response.message_id.toString()),
        () => clearChatLoadingState()
      );
      cancelStreamRef.current = cancel;
      streamingMessageIdRef.current = response.message_id;
    } catch {
      toast.error("Failed to draft SOAP note");
      clearChatLoadingState();
    } finally {
      setDraftingNote(false);
    }
  }, [selectedPatient, selectedVisit]);

  // Open shift handoff modal and fetch the AI-generated handoff document
  const openShiftHandoff = async () => {
    setHandoffOpen(true);
    setHandoffLoading(true);
    setHandoffDoc("");
    try {
      const data = await getShiftHandoff();
      setHandoffDoc(data.document);
      setHandoffCount(data.patient_count);
    } catch {
      setHandoffDoc("Failed to generate handoff. Please try again.");
    } finally {
      setHandoffLoading(false);
    }
  };

  return {
    // Tab
    activeTab,
    setActiveTab,
    // Queue
    queueVisits,
    queueLoading,
    refreshQueue: fetchQueue,
    // Patient
    selectedVisit,
    selectedPatient,
    patientLoading,
    selectVisit,
    // Pre-visit brief
    visitBrief,
    briefLoading,
    // Search
    searchQuery,
    searchResults,
    searchLoading,
    handleSearch,
    // Notes
    clinicalNotes,
    notesSaving,
    notesSaved,
    handleNotesChange,
    handleSaveNotes,
    // Actions
    handleAcceptPatient,
    handleDischarge,
    handleTransfer,
    // AI Chat
    chatMessages,
    chatLoading,
    currentActivity,
    activityDetails,
    chatSessionId,
    messagesEndRef,
    handleChatSubmit,
    handleStopAgent,
    handleResetChat,
    // DDx
    ddxDiagnoses,
    ddxLoading,
    // SOAP draft
    draftSoapNote,
    draftingNote,
    // Shift handoff
    handoffOpen,
    setHandoffOpen,
    handoffDoc,
    handoffCount,
    handoffLoading,
    openShiftHandoff,
  };
}
