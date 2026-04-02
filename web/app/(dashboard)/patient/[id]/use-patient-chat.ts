"use client";

import { useState, useRef, useEffect } from "react";
import { getSessionMessages } from "@/lib/api";
import type { ActiveForm } from "@/components/reception/form-input-bar";
import { createSseParser } from "@/lib/sse";
import { toast } from "sonner";
import { MessageRole } from "@/types/enums";
import type { Message, AgentActivity, LogItem } from "@/types/agent-ui";

export function usePatientChat(sessionId: string | null, patientId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState(!!sessionId);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;

      try {
        setLoadingSession(true);
        const sessionMessages = await getSessionMessages(parseInt(sessionId));

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
      } catch {
        toast.error("Failed to load chat session");
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [sessionId]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !patientId || isLoading) return;

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
          patient_id: patientId,
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

      const processSseChunk = createSseParser((parsed) => {
        if (parsed.error) throw new Error(String(parsed.error));

        if (
          typeof parsed.iteration === "number" &&
          typeof parsed.phase === "string"
        ) {
          if (parsed.phase === "thinking") {
            setCurrentActivity("thinking");
            setActivityDetails(`Step ${parsed.iteration}: Planning next actions`);
          } else if (parsed.phase === "acting") {
            setCurrentActivity("tool_calling");
            const toolCount = typeof parsed.tool_count === "number" ? parsed.tool_count : 0;
            setActivityDetails(
              `Step ${parsed.iteration}: Running ${toolCount} tool${toolCount > 1 ? "s" : ""}`
            );
          } else if (parsed.phase === "observing") {
            setCurrentActivity("analyzing");
            setActivityDetails(`Step ${parsed.iteration}: Reviewing results`);
          } else if (parsed.phase === "answering") {
            setCurrentActivity("thinking");
            setActivityDetails(`Step ${parsed.iteration}: Preparing answer`);
          }
        }

        if (typeof parsed.chunk === "string") {
          const words = parsed.chunk.match(/(\S+|\s+)/g) || [];
          wordBuffer.push(...words);
          setCurrentActivity(null);
          void displayWords();
        }

        if (parsed.tool_call && typeof parsed.tool_call === "object") {
          const toolCallData = parsed.tool_call as {
            id: string;
            tool: string;
            args: Record<string, unknown>;
          };
          setCurrentActivity("tool_calling");
          setActivityDetails(`Using ${toolCallData.tool}`);
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                const existingTools = msg.toolCalls || [];
                if (!existingTools.find((t) => t.id === toolCallData.id)) {
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

        if (parsed.tool_result && typeof parsed.tool_result === "object") {
          const toolResultData = parsed.tool_result as { id: string; result: string };
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

        if (typeof parsed.reasoning === "string") {
          setCurrentActivity("thinking");
          setActivityDetails("Formulating response");
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, reasoning: (msg.reasoning || "") + parsed.reasoning }
                : msg
            )
          );
        }

        if (parsed.log) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, logs: [...(msg.logs || []), parsed.log] as LogItem[] }
                : msg
            )
          );
        }

        if (Array.isArray(parsed.patient_references)) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, patientReferences: parsed.patient_references as Message["patientReferences"] }
                : msg
            )
          );
        }

        if (parsed.form_request && typeof parsed.form_request === "object") {
          const formRequest = parsed.form_request as ActiveForm;
          setActiveForm(formRequest);
          const formMsg =
            formRequest.schema?.message ||
            formRequest.schema?.title ||
            "Please fill out the form below.";
          accumulatedContent = formMsg;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: formMsg }
                : msg
            )
          );
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          await displayWords();
          break;
        }
        processSseChunk(decoder.decode(value, { stream: true }));
      }
    } catch {
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

  const handleFormSubmitted = () => {
    setActiveForm(null);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    currentActivity,
    activityDetails,
    loadingSession,
    activeForm,
    handleFormSubmitted,
    messagesEndRef,
    sendMessage,
    handleSendMessage,
    clearMessages: () => {
      setMessages([]);
      setActiveForm(null);
    },
  };
}
