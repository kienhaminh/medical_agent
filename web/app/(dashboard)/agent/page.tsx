"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import { MessageRole } from "@/types/enums";
import { Sparkles, RefreshCw, History, Plus } from "lucide-react";
import "highlight.js/styles/github-dark.css";

import { useChatSession } from "./use-chat-session";
import { ChatWelcome } from "./chat-welcome";
import { ChatInput } from "./chat-input";

function AgentChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("session");

  const {
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
  } = useChatSession(urlSessionId);

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20" />
        <div className="scan-line absolute inset-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center medical-border-glow">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-primary">
                  AI Medical Assistant
                </h1>
                <p className="text-xs text-muted-foreground">
                  Conversational interface • Context-aware
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentSessionId && (
                <Badge variant="clinical">Session #{currentSessionId}</Badge>
              )}
              <Badge variant="clinical">{messages.length} messages</Badge>
              <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-2">
                <Plus className="w-3 h-3" />
                New Chat
              </Button>
              {currentSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/agent/history")}
                  className="gap-2"
                >
                  <History className="w-3 h-3" />
                  History
                </Button>
              )}
              {messages.length > 0 && !currentSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNewChat()}
                  className="gap-2"
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
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading chat session...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <ChatWelcome onSelectPrompt={setInput} />
          ) : (
            <div className="space-y-6 pb-8">
              {messages.map((message, index) => (
                <div key={message.id} style={{ animationDelay: `${index * 50}ms` }}>
                  {message.role === MessageRole.USER ? (
                    <UserMessage content={message.content} />
                  ) : (
                    <div className="space-y-2">
                      <AgentMessage
                        content={message.content}
                        reasoning={message.reasoning}
                        toolCalls={message.toolCalls}
                        logs={message.logs}
                        timestamp={message.timestamp}
                        isLoading={isLoading && message.id === messages[messages.length - 1]?.id}
                        isLatest={message.id === messages[messages.length - 1]?.id}
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

      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export default function AgentChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <AgentChatPageContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
