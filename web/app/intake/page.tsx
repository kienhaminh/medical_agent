"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, RotateCcw, CheckCircle2, MapPin, Clock, FileCheck } from "lucide-react";
import { AnswerContent } from "@/components/agent/answer-content";
import { useIntakeChat, type FormSubmissionInfo } from "./use-intake-chat";
import { FormInputBar } from "@/components/reception/form-input-bar";

const SUGGESTIONS = [
  "Hi, I'd like to check in",
  "I have my patient ID",
  "I'm a new patient",
  "I need to see a doctor today",
];

const DEPT_LABELS: Record<string, string> = {
  emergency: "Emergency Department",
  cardiology: "Cardiology",
  neurology: "Neurology",
  orthopedics: "Orthopedics",
  radiology: "Radiology",
  internal_medicine: "Internal Medicine",
  general_checkup: "General Check-up",
  dermatology: "Dermatology",
  gastroenterology: "Gastroenterology",
  pulmonology: "Pulmonology",
  endocrinology: "Endocrinology",
  ophthalmology: "Ophthalmology",
  ent: "ENT",
  urology: "Urology",
};

function FormSubmittedCard({ info }: { info: FormSubmissionInfo }) {
  if (info.formType === "question" || info.formType === "yes_no") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-emerald-300">
              {info.answer || "Submitted"}
            </span>
          </div>
          {info.title && (
            <p className="text-xs text-muted-foreground/60 pl-6">{info.title}</p>
          )}
        </div>
      </div>
    );
  }

  // Multi-field form
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] rounded-2xl rounded-br-sm border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium text-emerald-300">
            {info.title}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 pl-6">
          {info.sectionCount > 0
            ? `${info.sectionCount} sections · ${info.fieldCount} fields submitted`
            : `${info.fieldCount} fields submitted`}
        </p>
      </div>
    </div>
  );
}

export default function PatientIntakePage() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    messagesEndRef,
    sendMessage,
    handleNewChat,
    triageStatus,
    activeForm,
    sessionId,
    activity,
    handleFormSubmitted,
  } = useIntakeChat();

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 dot-matrix-bg opacity-15" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/8 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-primary/8 via-transparent to-transparent" />
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
            <span className="font-display text-base font-bold tracking-wider text-primary">
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
                className="h-8 text-xs tracking-wider border-primary/20 hover:border-primary/40 hover:text-primary"
              >
                HOME
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content — always show chat, form replaces input bar */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="text-xs font-display tracking-widest text-primary">
                    RECEPTION AI ONLINE
                  </span>
                </div>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Welcome! I&apos;m the reception assistant. Just let me know
                  if you&apos;ve been here before or if this is your first
                  visit, and I&apos;ll get you checked in.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mt-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(undefined, suggestion)}
                      className="text-xs text-left px-3 py-2 rounded-lg border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              // Form submission confirmation card
              if (msg.formSubmission) {
                return (
                  <FormSubmittedCard key={msg.id} info={msg.formSubmission} />
                );
              }

              return (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary/10 text-foreground rounded-br-sm"
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
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        {activity && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            {activity}...
                          </span>
                        )}
                      </div>
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              );
            })}

            {/* Triage Status Card */}
            {triageStatus && !isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-emerald-400">Check-in Complete</h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                      <span className="text-xs text-muted-foreground">Directed to</span>
                      <span className="text-sm font-semibold text-foreground">
                        {DEPT_LABELS[triageStatus.department.toLowerCase()] || triageStatus.department}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                      <span className="text-xs text-muted-foreground">
                        A medical team will see you shortly
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-500/15">
                    <p className="text-[11px] text-muted-foreground/50">
                      Please proceed to the department and wait for your name to be called.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeForm && sessionId && (
              <div className="mt-2">
                <FormInputBar
                  activeForm={activeForm}
                  sessionId={sessionId}
                  onSubmitted={handleFormSubmitted}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom bar */}
        {!activeForm && (
          <form
            onSubmit={sendMessage}
            className="py-4 border-t border-border/50 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell us why you're visiting today..."
              disabled={isLoading || !!triageStatus}
              className="bg-card/50"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || !!triageStatus}
              size="icon"
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
