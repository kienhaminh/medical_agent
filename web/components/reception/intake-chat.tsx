"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Brain } from "lucide-react";
import type { Visit } from "@/lib/api";
import { FormInputBar, type ActiveForm } from "@/components/reception/form-input-bar";
import { createSseParser } from "@/lib/sse";

const TRACK_LINK_PATTERN = /(?:\/track\/)?(VIS-[\d]+-[\d]+)/;

function extractTrackingLink(content: string): string | null {
  const match = content.match(TRACK_LINK_PATTERN);
  return match ? `/track/${match[1]}` : null;
}

const TOOL_LABELS: Record<string, string> = {
  create_visit: "Setting up your visit…",
  complete_triage: "Routing you to the right department…",
  check_patient: "Checking our records…",
  compare_patient: "Checking our records…",
  register_patient: "Registering your details…",
  ask_user_input: "Preparing a form…",
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface IntakeChatProps {
  visit: Visit;
  patientId: number;
}

export function IntakeChat({ visit, patientId }: IntakeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [activityStatus, setActivityStatus] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const content = input.trim();
    setInput("");

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setIsThinking(true);
    setActivityStatus(null);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          patient_id: patientId,
          session_id: visit.intake_session_id,
          stream: true,
          mode: "intake",
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("Response body is not readable");

      let accumulated = "";
      const processSseChunk = createSseParser((parsed) => {
        if (typeof parsed.chunk === "string") {
          accumulated += parsed.chunk;
          setIsThinking(false);
          setActivityStatus(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: accumulated } : msg
            )
          );
        }

        if (typeof parsed.reasoning === "string" && parsed.reasoning) {
          setIsThinking(true);
          setActivityStatus(null);
        }

        if (parsed.tool_call && typeof parsed.tool_call === "object") {
          const toolCall = parsed.tool_call as { tool?: string };
          const label = (toolCall.tool && TOOL_LABELS[toolCall.tool]) || "Working on it…";
          setIsThinking(false);
          setActivityStatus(label);
        }

        if (parsed.tool_result) {
          setActivityStatus(null);
          setIsThinking(true);
        }

        if (parsed.done) {
          setIsThinking(false);
          setActivityStatus(null);
        }

        if (parsed.form_request && typeof parsed.form_request === "object") {
          const formRequest = parsed.form_request as ActiveForm;
          setActiveForm(formRequest);
          setIsThinking(false);
          setActivityStatus(null);
          const formMsg =
            formRequest.schema?.message ||
            formRequest.schema?.title ||
            "Please fill out the form below.";
          accumulated = formMsg;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: formMsg } : msg
            )
          );
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
      setIsThinking(false);
      setActivityStatus(null);
    }
  };

  return (
    <Card className="flex flex-col h-full border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-primary/5">
        <div className="font-semibold text-sm">Reception Agent</div>
        <div className="text-xs text-muted-foreground">Intake for {visit.visit_id}</div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Send a message to begin the intake conversation.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%] space-y-2">
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary/15 text-foreground"
                      : "bg-muted/50 text-foreground"
                  }`}
                >
                  {msg.content || (
                    isLoading && msg.role === "assistant" ? (
                      <div className="flex flex-col gap-1.5">
                        {activityStatus ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {activityStatus}
                          </span>
                        ) : isThinking ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Brain className="w-3.5 h-3.5" />
                            <span className="flex gap-0.5">
                              {[0, 200, 400].map((delay) => (
                                <span
                                  key={delay}
                                  className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce"
                                  style={{ animationDelay: `${delay}ms`, animationDuration: "1.2s" }}
                                />
                              ))}
                            </span>
                          </span>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )
                  )}
                </div>
                {msg.role === "assistant" && msg.content && (() => {
                  const trackHref = extractTrackingLink(msg.content);
                  return trackHref ? (
                    <a
                      href={trackHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-700 bg-green-950/40 text-green-400 text-xs font-medium hover:bg-green-950/70 transition-colors"
                    >
                      🔗 Track your visit progress
                    </a>
                  ) : null;
                })()}
              </div>
            </div>
          ))}
          {activeForm && visit.intake_session_id && (
            <div className="mt-2">
              <FormInputBar
                activeForm={activeForm}
                sessionId={visit.intake_session_id}
                onSubmitted={() => setActiveForm(null)}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      {!activeForm ? (
        <form onSubmit={sendMessage} className="p-3 border-t border-border/50 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your symptoms..."
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}
    </Card>
  );
}
