"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionMessages,
  sendChatMessage,
  streamMessageUpdates,
  type StreamEvent,
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
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function useChatSession(urlSessionId: string | null) {
  const router = useRouter();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(urlSessionId);
  const currentSessionIdRef = useRef<string | null>(urlSessionId);
  const isCreatingSessionRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState(!!urlSessionId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync local state with URL
  useEffect(() => {
    setCurrentSessionId(urlSessionId);
    if (urlSessionId) {
      currentSessionIdRef.current = urlSessionId;
    }
  }, [urlSessionId]);

  // Load session messages when currentSessionId is present
  useEffect(() => {
    const loadSession = async () => {
      if (!currentSessionId) return;

      if (isCreatingSessionRef.current) {
        isCreatingSessionRef.current = false;
        return;
      }

      try {
        setLoadingSession(true);
        const sessionMessages = await getSessionMessages(parseInt(currentSessionId));

        const convertedMessages: Message[] = sessionMessages.map((msg) => ({
          id: msg.id.toString(),
          role: msg.role as MessageRole,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          status: msg.status,
          toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : undefined,
          reasoning: msg.reasoning || undefined,
          logs: msg.logs ? JSON.parse(msg.logs) : undefined,
          patientReferences: msg.patient_references
            ? JSON.parse(msg.patient_references)
            : undefined,
        }));

        setMessages(convertedMessages);

        const inProgressMsg = convertedMessages.find(
          (msg) =>
            msg.role === MessageRole.ASSISTANT &&
            (msg.status === "streaming" || msg.status === "pending")
        );

        if (inProgressMsg) {
          setIsLoading(true);
          setCurrentActivity("thinking");
          setActivityDetails("Resuming processing...");

          const cancelStream = streamMessageUpdates(
            parseInt(inProgressMsg.id),
            (event: StreamEvent) => handleStreamEvent(event, inProgressMsg.id),
            (error: Error) => {
              toast.error(error.message);
              clearLoadingState();
            }
          );

          cancelPollRef.current = cancelStream;
        }
      } catch {
        toast.error("Failed to load chat session");
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [currentSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearLoadingState() {
    setIsLoading(false);
    setCurrentActivity(null);
    setActivityDetails("");
    cancelPollRef.current = null;
  }

  function handleStreamEvent(event: StreamEvent, messageId: string) {
    if (event.type === "chunk" || event.type === "content") {
      setMessages((prev) =>
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
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            status: event.status,
            content: event.content !== undefined ? event.content : msg.content,
            toolCalls: event.tool_calls ? event.tool_calls : msg.toolCalls,
            reasoning: event.reasoning !== undefined ? event.reasoning : msg.reasoning,
            logs: event.logs ? event.logs : msg.logs,
            patientReferences: event.patient_references
              ? event.patient_references
              : msg.patientReferences,
            tokenUsage: event.usage ? event.usage : msg.tokenUsage,
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, reasoning: (msg.reasoning || "") + event.content }
            : msg
        )
      );
    } else if (event.type === "log") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, logs: [...(msg.logs || []), event.content] }
            : msg
        )
      );
    } else if (event.type === "patient_references") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, patientReferences: event.patient_references }
            : msg
        )
      );
    } else if (event.type === "usage") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, tokenUsage: event.usage } : msg
        )
      );
    } else if (event.type === "done") {
      clearLoadingState();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, status: "completed" } : msg
        )
      );
    } else if (event.type === "error") {
      toast.error(event.message);
      clearLoadingState();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: msg.content + "\n\n⚠️ An error occurred.", status: "error" }
            : msg
        )
      );
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (cancelPollRef.current) {
      cancelPollRef.current();
      cancelPollRef.current = null;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput("");
    setIsLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Submitting your request...");

    try {
      const activeSessionId = currentSessionIdRef.current || currentSessionId;
      const response = await sendChatMessage({
        message: userInput,
        session_id: activeSessionId ? parseInt(activeSessionId) : undefined,
      });

      if (!currentSessionIdRef.current && response.session_id) {
        const newSessionId = response.session_id.toString();
        currentSessionIdRef.current = newSessionId;
        isCreatingSessionRef.current = true;
        setCurrentSessionId(newSessionId);
        const url = new URL(window.location.href);
        url.searchParams.set("session", newSessionId);
        router.replace(url.toString(), { scroll: false });
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

      setMessages((prev) => [...prev, assistantMessage]);
      setActivityDetails("Processing in background...");

      const cancelStream = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) => handleStreamEvent(event, response.message_id.toString()),
        (error: Error) => {
          toast.error(error.message);
          clearLoadingState();
        }
      );

      cancelPollRef.current = cancelStream;
    } catch {
      toast.error("Failed to send message");
      clearLoadingState();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNewChat = () => {
    if (cancelPollRef.current) {
      cancelPollRef.current();
      cancelPollRef.current = null;
    }
    setMessages([]);
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    isCreatingSessionRef.current = false;
    setInput("");
    setIsLoading(false);
    setCurrentActivity(null);
    setActivityDetails("");
    router.replace("/agent", { scroll: false });
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    currentActivity,
    activityDetails,
    loadingSession,
    currentSessionId,
    messagesEndRef,
    handleSubmit,
    handleKeyDown,
    handleNewChat,
  };
}
