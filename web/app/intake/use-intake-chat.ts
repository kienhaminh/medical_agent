// web/app/intake/use-intake-chat.ts
"use client";

import { useState, useRef, useEffect } from "react";
import type { ActiveForm } from "@/components/reception/form-input-bar";
import { createSseParser } from "@/lib/sse";

const INTAKE_SESSION_KEY = "intake_session";

interface StoredSession {
  sessionId: number;
  date: string; // "YYYY-MM-DD"
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readStoredSession(): StoredSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(INTAKE_SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredSession = JSON.parse(raw);
    if (parsed.date !== getTodayDate()) {
      localStorage.removeItem(INTAKE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(sessionId: number): void {
  const entry: StoredSession = { sessionId, date: getTodayDate() };
  localStorage.setItem(INTAKE_SESSION_KEY, JSON.stringify(entry));
}

function clearStoredSession(): void {
  localStorage.removeItem(INTAKE_SESSION_KEY);
}

export interface FormSubmissionInfo {
  title: string;
  formType: "multi_field" | "yes_no" | "question";
  sectionCount: number;
  fieldCount: number;
  /** For question forms: the selected answer(s). */
  answer?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present when this message represents a form submission confirmation. */
  formSubmission?: FormSubmissionInfo;
}

export interface TriageStatus {
  department: string;
  confidence: number;
  visitId?: string;
}

/** Human-readable labels for tool names shown during the ReAct loop. */
const TOOL_LABELS: Record<string, string> = {
  ask_user: "Preparing form",
  ask_user_input: "Preparing form",
  ask_user_question: "Asking question",
  query_patient_basic_info: "Looking up patient",
  triage_patient: "Triaging patient",
  search_patient: "Searching patient records",
  find_patient: "Looking up patient records",
  create_patient: "Creating patient record",
  create_visit: "Creating visit record",
  complete_triage: "Completing triage",
  get_patient: "Looking up patient",
  update_patient: "Updating patient record",
};

export function useIntakeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [triageStatus, setTriageStatus] = useState<TriageStatus | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  /** Human-readable activity label shown while the agent works (e.g. "Searching patient records"). */
  const [activity, setActivity] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, triageStatus]);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) return;

    setSessionId(stored.sessionId);

    fetch(`/api/chat/sessions/${stored.sessionId}/messages`)
      .then((res) => {
        if (!res.ok) {
          clearStoredSession();
          setSessionId(null);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const restored: ChatMessage[] = data
          .filter(
            (m: { role: string }) =>
              m.role === "user" || m.role === "assistant"
          )
          .map((m: { id: number; role: string; content: string }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        if (restored.length > 0) {
          setMessages(restored);
        }
      })
      .catch(() => {
        // Network unavailable — session ID kept so next message continues the same session
      });
  }, []);

  const sendMessage = async (e?: React.FormEvent, directMessage?: string) => {
    e?.preventDefault();
    const content = (directMessage ?? input).trim();
    if (!content || isLoading) return;

    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          stream: true,
          session_id: sessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulated = "";
      const processSseChunk = createSseParser((parsed) => {
        if (typeof parsed.chunk === "string") {
          if (activity) setActivity(null);
          accumulated += parsed.chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: accumulated }
                : msg
            )
          );
        }

        if (parsed.tool_call && typeof parsed.tool_call === "object") {
          const toolCall = parsed.tool_call as Record<string, unknown>;
          const toolName = String(toolCall.tool ?? toolCall.name ?? "");
          setActivity(
            TOOL_LABELS[toolName] ?? `Running ${toolName.replace(/_/g, " ")}`,
          );
        }

        if (parsed.tool_result) {
          setActivity("Analyzing results");
        }

        if (typeof parsed.session_id === "number" && !sessionId) {
          setSessionId(parsed.session_id);
          writeStoredSession(parsed.session_id);
        }

        if (parsed.form_request && typeof parsed.form_request === "object") {
          const formRequest = parsed.form_request as ActiveForm;
          setActiveForm(formRequest);
          setActivity(null);

          const formMsg =
            formRequest.schema?.message ||
            formRequest.schema?.title ||
            "Please fill out the form below.";
          accumulated = formMsg;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: formMsg }
                : msg
            )
          );
        }

        if (parsed.tool_result && typeof parsed.tool_result === "object") {
          const toolResult = parsed.tool_result as Record<string, unknown>;
          const resultText = toolResult.result;
          if (typeof resultText === "string" && resultText.includes("Triage completed")) {
            const deptMatch = resultText.match(/Auto-routed to:\s*([^(]+)/);
            const confMatch = resultText.match(/confidence:\s*([\d.]+)/);
            if (deptMatch) {
              setTriageStatus({
                department: deptMatch[1].trim(),
                confidence: confMatch ? parseFloat(confMatch[1]) : 0,
              });
            }
          }
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        processSseChunk(decoder.decode(value, { stream: true }));
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Connection error. Please try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setActivity(null);
    }
  };

  const handleFormSubmitted = (answers?: Record<string, string>) => {
    if (activeForm) {
      const schema = activeForm.schema;
      const sections = schema.sections ?? [];
      const fieldCount = sections.reduce((sum, s) => sum + s.fields.length, 0);

      // Build a human-readable answer summary for question/yes_no forms.
      let answer: string | undefined;
      if (schema.form_type === "question" && answers) {
        answer = answers.choices || answers.choice || undefined;
      } else if (schema.form_type === "yes_no" && answers) {
        answer = answers.confirmed === "true" ? "Confirmed" : "Cancelled";
      }

      const submissionMsg: ChatMessage = {
        id: `form-${Date.now()}`,
        role: "user",
        content: "",
        formSubmission: {
          title: schema.title || "Form",
          formType: schema.form_type,
          sectionCount: sections.length,
          fieldCount,
          answer,
        },
      };
      setMessages((prev) => [...prev, submissionMsg]);
    }
    setActiveForm(null);
  };

  const handleNewChat = () => {
    clearStoredSession();
    setMessages([]);
    setInput("");
    setSessionId(null);
    setTriageStatus(null);
    setActiveForm(null);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    messagesEndRef,
    sendMessage,
    handleNewChat,
    triageStatus,
    activeForm,
    sessionId,
    activity,
    handleFormSubmitted,
  };
}
