"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import type { AgentActivity, ToolCall, LogItem, PatientReference } from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import { getSessionMessages } from "@/lib/api";
import { toast } from "sonner";

import "highlight.js/styles/github-dark.css";
import {
  Send,
  Sparkles,
  RefreshCw,
  Activity,
  Brain,
  Zap,
  History,
  Plus,
} from "lucide-react";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  reasoning?: string;
  logs?: LogItem[];
  patientReferences?: PatientReference[];
}

function AgentChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("session");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    urlSessionId
  );
  const currentSessionIdRef = useRef<string | null>(urlSessionId);
  const isCreatingSessionRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(
    null
  );
  const [activityDetails, setActivityDetails] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState(!!urlSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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

      // Skip loading if we just created the session locally
      if (isCreatingSessionRef.current) {
        isCreatingSessionRef.current = false;
        return;
      }

      try {
        setLoadingSession(true);
        const sessionMessages = await getSessionMessages(
          parseInt(currentSessionId)
        );

        // Convert ChatMessage to Message format
        const convertedMessages: Message[] = sessionMessages.map((msg) => ({
          id: msg.id.toString(),
          role: msg.role as MessageRole,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : undefined,
          reasoning: msg.reasoning || undefined,
          // TODO: Load logs from DB if we decide to persist them
        }));

        setMessages(convertedMessages);
      } catch (error) {
        console.error("Failed to load session:", error);
        toast.error("Failed to load chat session");
      } finally {
        setLoadingSession(false);
      }
    };

    loadSession();
  }, [currentSessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
      const activeSessionId = currentSessionIdRef.current || currentSessionId;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          stream: true,
          session_id: activeSessionId ? parseInt(activeSessionId) : undefined,
        }),
      });

      if (!response.ok) throw new Error("API request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Response body is not readable");

      let accumulatedContent = "";
      let wordBuffer: string[] = [];
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
                // Match non-whitespace sequences OR whitespace sequences to preserve all characters
                const words = parsed.chunk.match(/(\S+|\s+)/g) || [];
                wordBuffer.push(...words);
                setCurrentActivity(null); // Stop progress once we get first chunk
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
                      // Check if already exists (unlikely with this stream logic but good safety)
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

              if (parsed.session_id) {
                const newSessionId = parsed.session_id.toString();
                console.log("Received session_id from backend:", newSessionId);
                // Update local state and URL if it's a new session
                if (!currentSessionIdRef.current) {
                  console.log("Setting currentSessionId to:", newSessionId);
                  currentSessionIdRef.current = newSessionId; // Immediate update
                  isCreatingSessionRef.current = true;
                  setCurrentSessionId(newSessionId);

                  const url = new URL(window.location.href);
                  url.searchParams.set("session", newSessionId);
                  router.replace(url.toString(), { scroll: false });
                } else {
                  console.log(
                    "currentSessionId already set:",
                    currentSessionIdRef.current
                  );
                }
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
            } catch (parseError) {
              // Ignore parse errors
            }
          }
        }
      }

      if (
        !accumulatedContent &&
        !messages.find((m) => m.id === assistantMessageId)?.toolCalls?.length
      ) {
        // If we have tool calls but no content yet, that's fine.
        // But if we have neither, it might be an error or just empty response.
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content:
                  msg.content +
                  "\n\n⚠️ Connection error. Please check if the backend server is running and try again.",
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    isCreatingSessionRef.current = false;
    setInput("");
    router.replace("/agent", { scroll: false });
  };

  const suggestedPrompts = [
    {
      icon: Brain,
      text: "Analyze patient symptoms and suggest diagnostic pathways",
    },
    {
      icon: Activity,
      text: "Explain the latest treatment protocols for hypertension",
    },
    {
      icon: Zap,
      text: "Summarize recent advances in medical imaging technology",
    },
    {
      icon: Sparkles,
      text: "Generate a differential diagnosis for chest pain",
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20" />
        <div className="scan-line absolute inset-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center medical-border-glow">
                  <Sparkles className="w-5 h-5 text-cyan-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  AI Medical Assistant
                </h1>
                <p className="text-xs text-muted-foreground">
                  Conversational interface • Context-aware
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentSessionId && (
                <Badge variant="outline" className="medical-badge-text">
                  Session #{currentSessionId}
                </Badge>
              )}
              <Badge variant="secondary" className="medical-badge-text">
                {messages.length} messages
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="secondary-button gap-2"
              >
                <Plus className="w-3 h-3" />
                New Chat
              </Button>
              {currentSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/agent/history")}
                  className="secondary-button gap-2"
                >
                  <History className="w-3 h-3" />
                  History
                </Button>
              )}
              {messages.length > 0 && !currentSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMessages([])}
                  className="secondary-button gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 relative z-10 min-h-0">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          {loadingSession ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-300px)]">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Loading chat session...
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] space-y-8 animate-in fade-in duration-700">
              {/* Logo/Icon */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center medical-border-glow">
                  <Sparkles className="w-12 h-12 text-cyan-500 animate-pulse" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full animate-pulse" />
              </div>

              {/* Welcome Message */}
              <div className="text-center space-y-3 max-w-2xl">
                <h2 className="font-display text-3xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  Ready to Assist
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Multi-modal medical AI assistant powered by advanced language
                  models. Ask questions, analyze cases, or discuss treatment
                  protocols.
                </p>
              </div>

              <Separator className="w-24" />

              {/* Suggested Prompts */}
              <div className="w-full max-w-3xl space-y-3">
                <p className="text-sm text-muted-foreground text-center font-medium">
                  Suggested prompts to get started:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suggestedPrompts.map((prompt, index) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => setInput(prompt.text)}
                        className="record-card group text-left p-4 hover:scale-[1.02] transition-all duration-200"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                            <Icon className="w-4 h-4 text-cyan-500" />
                          </div>
                          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                            {prompt.text}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-8">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {message.role === MessageRole.USER ? (
                    <UserMessage
                      content={message.content}
                      timestamp={message.timestamp}
                    />
                  ) : (
                    <AgentMessage
                      content={message.content}
                      reasoning={message.reasoning}
                      toolCalls={message.toolCalls}
                      logs={message.logs}
                      timestamp={message.timestamp}
                      isLoading={isLoading}
                      isLatest={
                        message.id === messages[messages.length - 1]?.id
                      }
                      currentActivity={
                        message.id === messages[messages.length - 1]?.id
                          ? currentActivity
                          : null
                      }
                      activityDetails={
                        message.id === messages[messages.length - 1]?.id
                          ? activityDetails
                          : undefined
                      }
                      patientReferences={message.patientReferences}
                      sessionId={currentSessionId || undefined}
                    />
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-5 max-w-5xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a medical question or describe a case... (Enter to send, Shift+Enter for new line)"
                className="min-h-[80px] max-h-[200px] resize-none pr-16 medical-input text-sm"
                disabled={isLoading}
              />
              <div className="absolute right-3 bottom-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isLoading}
                  className="primary-button gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>AI Ready</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <span>Powered by Advanced LLM</span>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-yellow-500">
                ⚠ Verify medical information
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AgentChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      }
    >
      <AgentChatPageContent />
    </Suspense>
  );
}

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";
