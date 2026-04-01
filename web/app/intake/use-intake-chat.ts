// web/app/intake/use-intake-chat.ts
"use client";

import { useState, useRef, useEffect } from "react";
import type { ActiveForm } from "@/components/reception/form-input-bar";

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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface TriageStatus {
  department: string;
  confidence: number;
  visitId?: string;
}

export function useIntakeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [triageStatus, setTriageStatus] = useState<TriageStatus | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          agent_role: "reception_triage",
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (parsed.chunk) {
                accumulated += parsed.chunk;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: accumulated }
                      : msg
                  )
                );
              }

              if (parsed.session_id && !sessionId) {
                setSessionId(parsed.session_id);
                writeStoredSession(parsed.session_id);
              }

              // Show the form — hide the input bar
              if (parsed.form_request) {
                setActiveForm(parsed.form_request as ActiveForm);
              }

              // Detect triage completion from tool results
              if (parsed.tool_result) {
                const resultText = parsed.tool_result.result || "";
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

              if (parsed.done) break;
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
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
    }
  };

  const handleFormSubmitted = () => {
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
    handleFormSubmitted,
  };
}
