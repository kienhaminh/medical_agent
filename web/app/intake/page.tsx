"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, RotateCcw } from "lucide-react";
import { AnswerContent } from "@/components/agent/answer-content";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function PatientIntakePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const content = input.trim();
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
  };

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 dot-matrix-bg opacity-30" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-cyan-500/8 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-teal-500/8 via-transparent to-transparent" />
        <div className="scan-line absolute inset-0" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-background/60 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 shrink-0">
              <Image
                src="/logo.png"
                alt="MediNexus Logo"
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="font-display text-base font-bold tracking-wider bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
              MEDI-NEXUS
            </span>
            <span className="text-muted-foreground text-sm hidden sm:block">
              / Patient Intake
            </span>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                disabled={isLoading}
                className="text-muted-foreground hover:text-foreground h-8 px-2 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">New chat</span>
              </Button>
            )}
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs tracking-wider border-cyan-500/30 hover:border-cyan-500/60 hover:text-cyan-500"
              >
                HOME
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                  <span className="text-xs font-display tracking-widest text-cyan-500">
                    RECEPTION AI ONLINE
                  </span>
                </div>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Welcome! I&apos;m the reception assistant. I&apos;ll help you
                  get checked in by collecting some information and directing
                  you to the right department.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mt-2">
                  {[
                    "I'd like to check in for a visit",
                    "I'm experiencing chest pain",
                    "I need to see a doctor today",
                    "This is my first time here",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-xs text-left px-3 py-2 rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 hover:border-cyan-500/40 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-cyan-500/15 text-foreground rounded-br-sm"
                      : "bg-muted/60 text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <AnswerContent
                        content={msg.content}
                        isLoading={isLoading}
                        isLatest={
                          msg.id === messages[messages.length - 1]?.id
                        }
                      />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="py-4 border-t border-border/50 flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell us why you're visiting today..."
            disabled={isLoading}
            className="bg-card/50"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
