"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentMessage } from "@/components/agent/agent-message";
import { UserMessage } from "@/components/agent/user-message";
import { MessageRole } from "@/types/enums";
import { Plus, History } from "lucide-react";
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-3 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">AI Medical Assistant</span>
              {currentSessionId && (
                <span className="text-xs text-muted-foreground/60">
                  #{currentSessionId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="gap-1.5 h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New chat
              </Button>
              {currentSessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/agent/history")}
                  className="gap-1.5 h-8 text-xs"
                >
                  <History className="w-3.5 h-3.5" />
                  History
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="container mx-auto px-6 py-6 max-w-3xl">
          {loadingSession ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-300px)]">
              <span className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <ChatWelcome onSelectPrompt={setInput} />
          ) : (
            <div className="space-y-6 pb-6">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-in fade-in slide-in-from-bottom-1 duration-200"
                  style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                >
                  {message.role === MessageRole.USER ? (
                    <UserMessage content={message.content} />
                  ) : (
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
          <span className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin" />
        </div>
      }
    >
      <AgentChatPageContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
