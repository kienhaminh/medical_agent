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
import type {
  AgentActivity,
  ToolCall,
  LogItem,
  PatientReference,
} from "@/types/agent-ui";
import { MessageRole } from "@/types/enums";
import {
  getSessionMessages,
  sendChatMessage,
  pollMessageStatus,
  type ChatMessage,
} from "@/lib/api";
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

  // Polling management
  const cancelPollRef = useRef<(() => void) | null>(null);

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
          status: msg.status,
          toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : undefined,
          reasoning: msg.reasoning || undefined,
          logs: msg.logs ? JSON.parse(msg.logs) : undefined,
          patientReferences: msg.patient_references
            ? JSON.parse(msg.patient_references)
            : undefined,
        }));

        setMessages(convertedMessages);

        // Check for any in-progress messages and resume polling
        const inProgressMsg = convertedMessages.find(
          (msg) =>
            msg.role === MessageRole.ASSISTANT &&
            (msg.status === "streaming" || msg.status === "pending")
        );

        if (inProgressMsg) {
          console.log("Resuming streaming for message", inProgressMsg.id);
          setIsLoading(true);
          setCurrentActivity("thinking");
          setActivityDetails("Resuming processing...");

          // Start polling for the in-progress message
          const cancelPoll = await pollMessageStatus(
            parseInt(currentSessionId),
            parseInt(inProgressMsg.id),
            (updatedMessage: ChatMessage) => {
              // Update the message in the messages array
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === updatedMessage.id.toString()) {
                    return {
                      ...msg,
                      content: updatedMessage.content,
                      status: updatedMessage.status,
                      toolCalls: updatedMessage.tool_calls
                        ? JSON.parse(updatedMessage.tool_calls)
                        : undefined,
                      reasoning: updatedMessage.reasoning || undefined,
                      logs: updatedMessage.logs
                        ? JSON.parse(updatedMessage.logs)
                        : undefined,
                      patientReferences: updatedMessage.patient_references
                        ? JSON.parse(updatedMessage.patient_references)
                        : undefined,
                    };
                  }
                  return msg;
                })
              );
            },
            () => {
              // Completed
              console.log("Resumed message completed!");
              setIsLoading(false);
              setCurrentActivity(null);
              setActivityDetails("");
              cancelPollRef.current = null;
            },
            (error: Error) => {
              // Error
              console.error("Polling error:", error);
              toast.error(error.message);
              setIsLoading(false);
              setCurrentActivity(null);
              setActivityDetails("");
              cancelPollRef.current = null;
            }
          );

          cancelPollRef.current = cancelPoll;
        }
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

    // Cancel any ongoing polling
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

      // Send message using background processing
      const response = await sendChatMessage({
        message: userInput,
        session_id: activeSessionId ? parseInt(activeSessionId) : undefined,
      });

      console.log("Received response:", response);

      // Update session if new
      if (!currentSessionIdRef.current && response.session_id) {
        const newSessionId = response.session_id.toString();
        currentSessionIdRef.current = newSessionId;
        isCreatingSessionRef.current = true;
        setCurrentSessionId(newSessionId);

        const url = new URL(window.location.href);
        url.searchParams.set("session", newSessionId);
        router.replace(url.toString(), { scroll: false });
      }

      // Add placeholder assistant message
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

      // Start polling for updates
      const cancelPoll = await pollMessageStatus(
        response.session_id,
        response.message_id,
        (updatedMessage: ChatMessage) => {
          // Update the message in real-time
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === updatedMessage.id.toString()) {
                return {
                  ...msg,
                  content: updatedMessage.content,
                  status: updatedMessage.status,
                  toolCalls: updatedMessage.tool_calls
                    ? JSON.parse(updatedMessage.tool_calls)
                    : undefined,
                  reasoning: updatedMessage.reasoning || undefined,
                  logs: updatedMessage.logs
                    ? JSON.parse(updatedMessage.logs)
                    : undefined,
                  patientReferences: updatedMessage.patient_references
                    ? JSON.parse(updatedMessage.patient_references)
                    : undefined,
                };
              }
              return msg;
            })
          );

          // Update activity based on status
          if (updatedMessage.status === "streaming") {
            setCurrentActivity("thinking");
            setActivityDetails("Generating response...");
          } else if (updatedMessage.status === "pending") {
            setCurrentActivity("thinking");
            setActivityDetails("Processing...");
          }
        },
        () => {
          // Completed
          console.log("Message completed!");
          setIsLoading(false);
          setCurrentActivity(null);
          setActivityDetails("");
          cancelPollRef.current = null;
        },
        (error: Error) => {
          // Error
          console.error("Polling error:", error);
          toast.error(error.message);
          setIsLoading(false);
          setCurrentActivity(null);
          setActivityDetails("");
          cancelPollRef.current = null;

          // Update message with error
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === response.message_id.toString()
                ? {
                    ...msg,
                    content:
                      msg.content +
                      "\n\n⚠️ An error occurred while processing your request.",
                    status: "error",
                  }
                : msg
            )
          );
        }
      );

      cancelPollRef.current = cancelPoll;
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
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
    // Cancel any ongoing polling
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
        <div className="container mx-auto px-6 py-8 max-w-4xl">
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
                    <UserMessage content={message.content} />
                  ) : (
                    <div className="space-y-2">
                      {/* Status indicator for background processing */}
                      {(message.status === "streaming" ||
                        message.status === "pending") && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                            <span>
                              {message.status === "streaming"
                                ? "Streaming response"
                                : "Processing in background"}
                            </span>
                          </div>
                          {message.content && (
                            <span className="animate-pulse">▊</span>
                          )}
                        </div>
                      )}

                      <AgentMessage
                        content={message.content}
                        reasoning={message.reasoning}
                        toolCalls={message.toolCalls}
                        logs={message.logs}
                        timestamp={message.timestamp}
                        isLoading={
                          isLoading &&
                          message.id === messages[messages.length - 1]?.id
                        }
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
                        tokenUsage={message.tokenUsage}
                      />
                    </div>
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
        <div className="container mx-auto px-6 py-5 max-w-4xl">
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
