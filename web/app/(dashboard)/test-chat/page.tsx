"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSessionMessages,
  sendChatMessage,
  streamMessageUpdates,
  type ChatMessage,
  type StreamEvent,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Image from "next/image";

const API_BASE_URL = "http://localhost:8000";

// Component to render message content with image support
function MessageContent({ content }: { content: string }) {
  // Regular expressions for image detection
  const markdownImageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
  const urlImageRegex =
    /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)/gi;

  let processedContent = content;
  const images: Array<{ alt: string; url: string; index: number }> = [];
  let imageIndex = 0;

  // Extract markdown images: ![alt](url)
  processedContent = processedContent.replace(
    markdownImageRegex,
    (match, alt, url) => {
      const placeholder = `__IMAGE_${imageIndex}__`;
      images.push({ alt: alt || "Image", url, index: imageIndex });
      imageIndex++;
      return placeholder;
    }
  );

  // Extract standalone image URLs
  processedContent = processedContent.replace(urlImageRegex, (match) => {
    // Don't replace if already part of markdown
    if (content.includes(`](${match})`)) {
      return match;
    }
    const placeholder = `__IMAGE_${imageIndex}__`;
    images.push({ alt: "Image", url: match, index: imageIndex });
    imageIndex++;
    return placeholder;
  });

  // Split content by image placeholders
  const parts = processedContent.split(/(__IMAGE_\d+__)/);

  return (
    <div className="space-y-2">
      {parts.map((part, idx) => {
        const imageMatch = part.match(/__IMAGE_(\d+)__/);
        if (imageMatch) {
          const imgIndex = parseInt(imageMatch[1], 10);
          const img = images.find((i) => i.index === imgIndex);
          if (img) {
            return (
              <div key={idx} className="my-2">
                <Image
                  src={img.url}
                  alt={img.alt}
                  width={400}
                  height={300}
                  className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                  unoptimized
                />
                {img.alt && img.alt !== "Image" && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {img.alt}
                  </p>
                )}
              </div>
            );
          }
        }
        return part ? (
          <p key={idx} className="text-sm whitespace-pre-wrap">
            {part}
          </p>
        ) : null;
      })}
    </div>
  );
}

function TestChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<ChatMessage | null>(
    null
  );
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const cancelPollRef = useRef<(() => void) | null>(null);

  // Load session from URL on mount
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("session");
    if (sessionIdFromUrl) {
      const id = parseInt(sessionIdFromUrl, 10);
      setSessionId(id);
      loadSessionMessages(id);
    }
  }, [searchParams]);

  // Load existing messages for a session
  const loadSessionMessages = async (sessionId: number) => {
    setIsLoadingHistory(true);
    addLog(`📥 Loading messages for session ${sessionId}...`);
    try {
      const msgs = await getSessionMessages(sessionId);
      setMessages(msgs);
      addLog(`✅ Loaded ${msgs.length} messages`);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load messages";
      addLog(`❌ ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (cancelPollRef.current) {
        cancelPollRef.current();
      }
    };
  }, []);

  const addLog = (log: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  // SSE streaming handler (Background Task)
  const startBackgroundStream = async (
    sessionId: number | null,
    messageText: string
  ) => {
    addLog("🚀 Sending message to background task...");

    try {
      // 1. Send message to API
      const response = await sendChatMessage({
        message: messageText,
        session_id: sessionId,
        user_id: "test_user",
      });

      addLog(
        `✅ Task started! Task ID: ${response.task_id}, Message ID: ${response.message_id}`
      );

      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
        router.push(`/test-chat?session=${response.session_id}`, {
          scroll: false,
        });
      }

      // 2. Start streaming updates
      addLog(
        `📡 Connecting to SSE stream for message ${response.message_id}...`
      );

      let accumulatedContent = "";

      const cancelStream = streamMessageUpdates(
        response.message_id,
        (event: StreamEvent) => {
          // Handle 'content' (new) and 'chunk' (legacy) event types
          if (event.type === "chunk" || event.type === "content") {
            accumulatedContent += event.content;
            updateAssistantMessage(
              response.message_id,
              accumulatedContent,
              "streaming"
            );
            addLog(`💬 Chunk: ${event.content.length} chars`);
          } else if (event.type === "status") {
            // Initial status or full update
            if (event.content) {
              accumulatedContent = event.content;
              updateAssistantMessage(
                response.message_id,
                accumulatedContent,
                event.status
              );
            }
            addLog(`ℹ️ Status: ${event.status}`);
          } else if (event.type === "tool_call") {
            addLog(`🔧 Tool Call: ${event.tool}`);
          } else if (event.type === "tool_result") {
            addLog(`✅ Tool Result`);
          } else if (event.type === "reasoning") {
            addLog(`🧠 Reasoning: ${event.content.substring(0, 50)}...`);
          } else if (event.type === "done") {
            addLog("✅ Stream completed!");
            setIsSubmitting(false);
            cancelPollRef.current = null;
            // Reload to get final consistent state
            if (response.session_id) loadSessionMessages(response.session_id);
          } else if (event.type === "error") {
            addLog(`❌ Stream Error: ${event.message}`);
            setError(event.message);
            setIsSubmitting(false);
          }
        },
        (err) => {
          addLog(`❌ Connection Error: ${err.message}`);
          setError(err.message);
          setIsSubmitting(false);
        }
      );

      cancelPollRef.current = cancelStream;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Failed to send message: ${errorMsg}`);
      setError(errorMsg);
      setIsSubmitting(false);
    }
  };

  const updateAssistantMessage = (
    msgId: number,
    content: string,
    status: string
  ) => {
    setCurrentMessage((prev) => ({
      id: msgId,
      session_id: sessionId || 0,
      role: "assistant",
      content: content,
      created_at: new Date().toISOString(),
      status: status,
      tool_calls: null,
      reasoning: null,
      patient_references: null,
      logs: null,
      token_usage: null,
      error_message: null,
      last_updated_at: new Date().toISOString(),
    }));

    setMessages((prev) => {
      const existing = prev.find((m) => m.id === msgId);
      if (existing) {
        return prev.map((m) =>
          m.id === msgId ? { ...m, content, status } : m
        );
      }
      // Append if not exists (or if it was a placeholder)
      // Actually sendChatMessage creates a placeholder in DB, but we might not have reloaded it yet.
      // Let's just append or update the last one if it looks like a placeholder.
      const lastMsg = prev[prev.length - 1];
      if (
        lastMsg &&
        lastMsg.role === "assistant" &&
        lastMsg.status === "pending"
      ) {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, id: msgId, content, status },
        ];
      }
      return [
        ...prev,
        {
          id: msgId,
          session_id: sessionId || 0,
          role: "assistant",
          content,
          created_at: new Date().toISOString(),
          status,
          tool_calls: null,
          reasoning: null,
          patient_references: null,
          logs: null,
          token_usage: null,
          error_message: null,
          last_updated_at: new Date().toISOString(),
        },
      ];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setCurrentMessage(null);
    setLogs([]);

    // Clear input
    const messageText = message.trim();
    setMessage("");

    try {
      // Start TRUE streaming via Background Task + SSE
      await startBackgroundStream(sessionId, messageText);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      addLog(`❌ Failed to start stream: ${errorMsg}`);
      setError(errorMsg);
      setIsSubmitting(false);
    }
  };

  const startNewConversation = () => {
    // Cancel any ongoing streaming
    if (cancelPollRef.current) {
      cancelPollRef.current();
    }

    // Clear state
    setSessionId(null);
    setMessages([]);
    setCurrentMessage(null);
    setError(null);
    setLogs([]);
    setIsSubmitting(false);

    // Clear URL
    router.push("/test-chat", { scroll: false });
    addLog("🆕 Started new conversation");
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "streaming":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
      case "interrupted":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "streaming":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "interrupted":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const parseTokenUsage = (tokenUsageStr: string | null | undefined) => {
    if (!tokenUsageStr) return null;
    try {
      return JSON.parse(tokenUsageStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">⚡ SSE Streaming Chat</h1>
          <p className="text-muted-foreground">
            Real-time streaming chat via Background Task + SSE - see responses
            as they're generated!
            {sessionId && (
              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                Session: {sessionId}
              </span>
            )}
          </p>
        </div>
        {sessionId && (
          <Button
            variant="outline"
            size="sm"
            onClick={startNewConversation}
            disabled={isSubmitting}
          >
            New Conversation
          </Button>
        )}
      </div>

      {/* Input Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Send Test Message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isSubmitting}
              className="flex-1"
            />
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Send"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Message History */}
      {messages.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              Message History ({messages.length} messages)
              {isLoadingHistory && (
                <Loader2 className="inline ml-2 h-4 w-4 animate-spin" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500"
                    : "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {msg.role === "user" ? "👤 User" : "🤖 Assistant"}
                    </span>
                    {msg.status && msg.role === "assistant" && (
                      <Badge
                        variant="secondary"
                        className={`${getStatusColor(
                          msg.status
                        )} text-white text-xs flex items-center gap-1`}
                      >
                        {(msg.status === "streaming" ||
                          msg.status === "pending") && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {msg.status}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="relative">
                  <MessageContent content={msg.content} />
                  {(msg.status === "streaming" || msg.status === "pending") &&
                    msg.role === "assistant" && (
                      <span className="inline-block ml-1 animate-pulse text-green-600">
                        ▊
                      </span>
                    )}
                </div>
                {msg.error_message && (
                  <p className="text-xs text-red-500 mt-2">
                    Error: {msg.error_message}
                  </p>
                )}
                {msg.role === "assistant" &&
                  (() => {
                    const usage = parseTokenUsage(msg.token_usage);
                    return usage ? (
                      <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                        <span>
                          <strong>Tokens:</strong> {usage.total_tokens || 0}
                        </span>
                        <span>
                          <strong>Prompt:</strong>{" "}
                          {usage.prompt_tokens || usage.input_tokens || 0}
                        </span>
                        <span>
                          <strong>Completion:</strong>{" "}
                          {usage.completion_tokens || usage.output_tokens || 0}
                        </span>
                      </div>
                    ) : null;
                  })()}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Message Status */}
      {currentMessage && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Message Status</CardTitle>
              <Badge
                variant="secondary"
                className={`${getStatusColor(
                  currentMessage.status
                )} text-white`}
              >
                <span className="flex items-center gap-1">
                  {getStatusIcon(currentMessage.status)}
                  {currentMessage.status?.toUpperCase()}
                </span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timeline */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>
                  {new Date(currentMessage.created_at).toLocaleTimeString()}
                </span>
              </div>
              {currentMessage.streaming_started_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span>
                    {new Date(
                      currentMessage.streaming_started_at
                    ).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {currentMessage.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <span>
                    {new Date(currentMessage.completed_at).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {currentMessage.last_updated_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>
                    {new Date(
                      currentMessage.last_updated_at
                    ).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            {currentMessage.content && (
              <div className="space-y-2">
                <div className="font-semibold">Response:</div>
                <div className="bg-muted p-4 rounded-lg">
                  <MessageContent content={currentMessage.content} />
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>{currentMessage.content.length} characters</span>
                  {(() => {
                    const usage = parseTokenUsage(currentMessage.token_usage);
                    return usage ? (
                      <>
                        <span>•</span>
                        <span>
                          <strong>Tokens:</strong> {usage.total_tokens || 0}
                        </span>
                        <span>
                          <strong>Prompt:</strong>{" "}
                          {usage.prompt_tokens || usage.input_tokens || 0}
                        </span>
                        <span>
                          <strong>Completion:</strong>{" "}
                          {usage.completion_tokens || usage.output_tokens || 0}
                        </span>
                      </>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* Error Message */}
            {currentMessage.error_message && (
              <div className="space-y-2">
                <div className="font-semibold text-red-500">Error:</div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-red-700 dark:text-red-300">
                    {currentMessage.error_message}
                  </p>
                </div>
              </div>
            )}

            {/* Tool Calls */}
            {currentMessage.tool_calls && (
              <div className="space-y-2">
                <div className="font-semibold">Tool Calls:</div>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                  {currentMessage.tool_calls}
                </pre>
              </div>
            )}

            {/* Reasoning */}
            {currentMessage.reasoning && (
              <div className="space-y-2">
                <div className="font-semibold">Reasoning:</div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">
                    {currentMessage.reasoning}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">
                No logs yet. Send a message to start.
              </div>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Streaming Indicator */}
      {isSubmitting && (
        <Card className="mt-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-green-700 dark:text-green-300">
                ⚡ Background Task Streaming Active
              </span>
              <span className="text-green-600 dark:text-green-400">
                - Receiving real-time updates via SSE connection
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-6 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-600 dark:text-blue-400">
            Test Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>What to test:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Send a message like "Tell me a long story about a robot"</li>
            <li>
              Watch the URL update with <code>?session=X</code> for persistence
            </li>
            <li>
              <strong>✨ TRUE STREAMING</strong> - Experience real-time response
              streaming via SSE (Server-Sent Events)!
            </li>
            <li>
              See content appearing character by character as it's generated by
              the LLM
            </li>
            <li>
              Watch live tool calls, reasoning, and token usage in the logs
            </li>
            <li>
              <strong>🔄 Reload test:</strong> While the message is still
              streaming, refresh the page (F5 or Cmd+R) - the streaming should
              continue automatically where it left off!
            </li>
            <li>
              <strong>🎯 Navigation test:</strong> While streaming, navigate to
              /agent, then come back - resume from previous session!
            </li>
            <li>
              <strong>🔗 URL sharing test:</strong> Copy the URL with session
              parameter and open in a new tab - see full conversation history!
            </li>
            <li>
              <strong>🖼️ Image test:</strong> Ask for an image like "Show me a
              cat image from https://placekitten.com/400/300" or use markdown
              format - images render inline!
            </li>
          </ul>
          <p className="mt-4">
            <strong>Expected behavior:</strong> Real-time streaming via SSE
            (Server-Sent Events). Content streams as soon as it's generated,
            with no polling delays or refresh intervals. True live streaming
            experience over SSE connection!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TestChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TestChatPageContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
