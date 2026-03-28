"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  listActiveVisits,
  getPatient,
  searchPatients,
  saveClinicalNotes,
  completeVisit,
  transferVisit,
  sendChatMessage,
  streamMessageUpdates,
  getVisitBrief,
  getDifferentialDiagnosis,
  listAgents,
  type VisitListItem,
  type PatientDetail,
  type Patient,
  type StreamEvent,
  type DiagnosisItem,
  type AgentInfo,
} from "@/lib/api";
import type { AgentActivity, ToolCall, LogItem, PatientReference } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import { toast } from "sonner";

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
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState("");
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const chatSessionIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Differential diagnosis state
  const [ddxDiagnoses, setDdxDiagnoses] = useState<DiagnosisItem[]>([]);
  const [ddxLoading, setDdxLoading] = useState(false);

  // Specialist agents — filtered to roles ending in "_consultant"
  const [specialists, setSpecialists] = useState<AgentInfo[]>([]);

  // SOAP draft state
  const [draftingNote, setDraftingNote] = useState(false);

  // AI panel state
  const [aiWidth, setAiWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);

  // Fetch active visits queue
  const fetchQueue = useCallback(async () => {
    try {
      const visits = await listActiveVisits();
      // Filter to in_department visits only
      const inDepartment = visits.filter((v) => v.status === "in_department");
      setQueueVisits(inDepartment);
    } catch {
      // Silently fail on poll
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Load specialist agents once on mount
  useEffect(() => {
    listAgents()
      .then((agents) =>
        setSpecialists(agents.filter((a) => a.role.endsWith("_consultant")))
      )
      .catch(() => {});
  }, []);

  // Load patient when visit selected
  const selectVisit = useCallback(async (visit: VisitListItem) => {
    setSelectedVisit(visit);
    setActiveTab("patient");
    setPatientLoading(true);
    // Reset chat, brief, and DDx for new patient
    setChatMessages([]);
    setChatSessionId(null);
    chatSessionIdRef.current = null;
    setVisitBrief("");
    setDdxDiagnoses([]);
    setDdxLoading(false);
    try {
      const patient = await getPatient(visit.patient_id);
      setSelectedPatient(patient);
      setClinicalNotes((visit as any).clinical_notes || "");
      setNotesSaved(false);
    } catch {
      toast.error("Failed to load patient details");
    } finally {
      setPatientLoading(false);
    }
    // Fetch pre-visit brief asynchronously after patient load
    setBriefLoading(true);
    getVisitBrief(visit.id)
      .then((data) => setVisitBrief(data.brief))
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

  // Quick actions
  const handleDischarge = useCallback(async () => {
    if (!selectedVisit) return;
    try {
      await completeVisit(selectedVisit.id);
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
    cancelStreamRef.current = null;
  }

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
    } else if (event.type === "tool_result") {
      setCurrentActivity("analyzing");
      setActivityDetails("Processing tool result...");
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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    const userInput = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Submitting your request...");

    try {
      const response = await sendChatMessage({
        message: userInput,
        patient_id: selectedPatient?.id,
        session_id: chatSessionIdRef.current,
      });

      if (!chatSessionIdRef.current && response.session_id) {
        chatSessionIdRef.current = response.session_id;
        setChatSessionId(response.session_id);
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

      const cancelStream = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) =>
          handleStreamEvent(event, response.message_id.toString()),
        () => clearChatLoadingState()
      );
      cancelStreamRef.current = cancelStream;
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
        session_id: chatSessionIdRef.current,
      });

      if (!chatSessionIdRef.current && response.session_id) {
        chatSessionIdRef.current = response.session_id;
        setChatSessionId(response.session_id);
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

      const cancelStream = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) =>
          handleStreamEvent(event, response.message_id.toString()),
        () => clearChatLoadingState()
      );
      cancelStreamRef.current = cancelStream;
    } catch {
      toast.error("Failed to draft SOAP note");
      clearChatLoadingState();
    } finally {
      setDraftingNote(false);
      setActiveTab("notes");
    }
  }, [selectedPatient, selectedVisit]);

  /**
   * Send a one-shot question to a specialist agent and stream the full reply.
   * The specialist's name is embedded in the message so the Doctor AI routes
   * the request to the correct sub-agent on the backend.
   */
  const consultSpecialist = async (
    specialist: AgentInfo,
    question: string
  ): Promise<string> => {
    // Build message with specialist context and optional patient context
    const messageText = selectedPatient
      ? `[Consult request for ${specialist.name}] ${question}\n\nPatient context: ${selectedPatient.name} (ID: ${selectedPatient.id})`
      : `[Consult request for ${specialist.name}] ${question}`;

    const chatResp = await sendChatMessage({
      message: messageText,
      patient_id: selectedPatient?.id,
      session_id: undefined,
    });

    // Stream the response and accumulate the full text
    return new Promise<string>((resolve, reject) => {
      let fullContent = "";
      const cleanup = streamMessageUpdates(
        chatResp.message_id,
        (event) => {
          if (event.type === "chunk" || event.type === "content") {
            fullContent += event.content;
          } else if (event.type === "status" && event.content !== undefined) {
            // Final status update may carry the complete content
            fullContent = event.content;
          } else if (event.type === "done") {
            cleanup();
            resolve(fullContent || "(No response)");
          } else if (event.type === "error") {
            cleanup();
            reject(new Error(event.message));
          }
        },
        (err) => {
          cleanup();
          reject(err);
        }
      );
    });
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
    // Actions
    handleDischarge,
    handleTransfer,
    // AI Chat
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    currentActivity,
    activityDetails,
    chatSessionId,
    messagesEndRef,
    handleChatSubmit,
    // DDx
    ddxDiagnoses,
    ddxLoading,
    generateDdx,
    // SOAP draft
    draftSoapNote,
    draftingNote,
    // Specialist consult
    specialists,
    consultSpecialist,
    // AI Panel
    aiWidth,
    setAiWidth,
    isResizing,
    setIsResizing,
  };
}
