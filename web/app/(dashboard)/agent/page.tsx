"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AgentMessage } from "@/components/agent/agent-message";
import { AgentProgress, type AgentActivity } from "@/components/agent/agent-progress";
import type { ToolCall } from "@/components/agent/tool-call-item";

import "highlight.js/styles/github-dark.css";
import { Send, Sparkles, RefreshCw, Activity, Brain, Zap } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

export default function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<AgentActivity | null>(null);
  const [activityDetails, setActivityDetails] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput("");
    setIsLoading(true);
    setCurrentActivity("thinking");
    setActivityDetails("Processing your request...");

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      toolCalls: [],
      reasoning: "",
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput, stream: true }),
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
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
              )
            );
            await new Promise(resolve => setTimeout(resolve, 30));
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
                setActivityDetails(`Executing ${toolCallData.tool}...`);
                setMessages(prev => 
                  prev.map(msg => {
                    if (msg.id === assistantMessageId) {
                      const existingTools = msg.toolCalls || [];
                      // Check if already exists (unlikely with this stream logic but good safety)
                      if (!existingTools.find(t => t.id === toolCallData.id)) {
                        return {
                          ...msg,
                          toolCalls: [...existingTools, {
                            id: toolCallData.id,
                            tool: toolCallData.tool,
                            args: toolCallData.args
                          }]
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
                setActivityDetails("Analyzing results...");
                setMessages(prev =>
                  prev.map(msg => {
                    if (msg.id === assistantMessageId && msg.toolCalls) {
                      return {
                        ...msg,
                        toolCalls: msg.toolCalls.map(t =>
                          t.id === toolResultData.id
                            ? { ...t, result: toolResultData.result }
                            : t
                        )
                      };
                    }
                    return msg;
                  })
                );
              }

              if (parsed.reasoning) {
                setCurrentActivity("thinking");
                setActivityDetails("Formulating response...");
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, reasoning: (msg.reasoning || "") + parsed.reasoning } 
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

      if (!accumulatedContent && !messages.find(m => m.id === assistantMessageId)?.toolCalls?.length) {
         // If we have tool calls but no content yet, that's fine. 
         // But if we have neither, it might be an error or just empty response.
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + "\n\n⚠️ Connection error. Please check if the backend server is running and try again." }
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

  const suggestedPrompts = [
    { icon: Brain, text: "Analyze patient symptoms and suggest diagnostic pathways" },
    { icon: Activity, text: "Explain the latest treatment protocols for hypertension" },
    { icon: Zap, text: "Summarize recent advances in medical imaging technology" },
    { icon: Sparkles, text: "Generate a differential diagnosis for chest pain" },
  ];

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20" />
        <div className="scan-line absolute inset-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
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
              <Badge variant="secondary" className="medical-badge-text">
                {messages.length} messages
              </Badge>
              {messages.length > 0 && (
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
      <div className="flex-1 relative z-10 overflow-y-auto custom-scrollbar">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          {messages.length === 0 ? (
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
                  Multi-modal medical AI assistant powered by advanced language models.
                  Ask questions, analyze cases, or discuss treatment protocols.
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
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {message.role === "user" ? (
                    // User Message
                    <div className="flex justify-end">
                      <div className="max-w-[80%] space-y-2">
                        <Card className="p-4 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 medical-border-glow">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                            {message.content}
                          </p>
                        </Card>
                        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                          <span>You</span>
                          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
                          <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Assistant Message
                    <AgentMessage
                      content={message.content}
                      reasoning={message.reasoning}
                      toolCalls={message.toolCalls}
                      timestamp={message.timestamp}
                      isLoading={isLoading}
                      isLatest={message.id === messages[messages.length - 1]?.id}
                    />
                  )}
                </div>
              ))}

              {/* Agent Progress Indicator */}
              {currentActivity && (
                <AgentProgress
                  activity={currentActivity}
                  details={activityDetails}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

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
              <span className="text-yellow-500">⚠ Verify medical information</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

