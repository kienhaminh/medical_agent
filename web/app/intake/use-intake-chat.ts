"use client";

import { useState, useRef, useEffect } from "react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, triageStatus]);

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
              }
              // Detect triage completion from tool results
              if (parsed.tool_result) {
                const result = parsed.tool_result;
                const resultText = result.result || "";
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

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setSessionId(null);
    setTriageStatus(null);
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
  };
}
