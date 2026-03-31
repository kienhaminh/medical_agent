"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";

interface ConsultationMessage {
  id: string;
  round: number;
  sender_type: "specialist" | "chief";
  specialist_role: string | null;
  content: string;
  agrees_with: string[] | null;
  challenges: string[] | null;
}

interface ConsultationThread {
  id: string;
  status: string;
  current_round: number;
  synthesis: string;
  messages: ConsultationMessage[];
}

interface ParsedSynthesis {
  primaryRecommendation: string;
  confidence: string;
  supporting: string;
  dissent: string;
  chiefNotes: string;
}

function parseSynthesis(content: string): ParsedSynthesis {
  const get = (label: string): string => {
    const regex = new RegExp(`${label}:[\\t ]*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]*:|\\s*$)`, "i");
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  };
  return {
    primaryRecommendation: get("PRIMARY RECOMMENDATION"),
    confidence: get("CONFIDENCE"),
    supporting: get("SUPPORTING"),
    dissent: get("DISSENT"),
    chiefNotes: get("CHIEF NOTES"),
  };
}

function confidenceColor(confidence: string): string {
  const c = confidence.toLowerCase();
  if (c === "high") return "text-emerald-400";
  if (c === "moderate") return "text-amber-400";
  return "text-red-400";
}

interface ConsultationCardProps {
  content: string;
  threadId?: string;
}

export function ConsultationCard({ content, threadId }: ConsultationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [thread, setThread] = useState<ConsultationThread | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = parseSynthesis(content);

  const loadThread = async () => {
    if (!threadId || thread) {
      setExpanded((e) => !e);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/case-threads/${threadId}`);
      if (resp.ok) setThread(await resp.json());
    } finally {
      setLoading(false);
      setExpanded(true);
    }
  };

  const roundGroups = thread
    ? thread.messages.reduce<Record<number, ConsultationMessage[]>>((acc, msg) => {
        (acc[msg.round] = acc[msg.round] ?? []).push(msg);
        return acc;
      }, {})
    : {};

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-card/60 overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20">
        <Users className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
          Team Consultation
        </span>
        {parsed.confidence && (
          <span className={`ml-auto text-xs font-medium ${confidenceColor(parsed.confidence)}`}>
            {parsed.confidence.toUpperCase()} confidence
          </span>
        )}
      </div>

      {/* Primary Recommendation */}
      <div className="px-4 py-3">
        {parsed.primaryRecommendation && (
          <p className="text-sm text-foreground leading-relaxed mb-2">
            {parsed.primaryRecommendation}
          </p>
        )}

        {/* Supporting / Dissent */}
        <div className="flex flex-col gap-1 mt-2">
          {parsed.supporting && parsed.supporting !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-400 font-medium">Supporting: </span>
              {parsed.supporting}
            </p>
          )}
          {parsed.dissent && parsed.dissent !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-amber-400 font-medium">Dissent: </span>
              {parsed.dissent}
            </p>
          )}
          {parsed.chiefNotes && parsed.chiefNotes !== "None" && (
            <p className="text-xs text-muted-foreground">
              <span className="text-cyan-400 font-medium">Notes: </span>
              {parsed.chiefNotes}
            </p>
          )}
        </div>
      </div>

      {/* Thread expand toggle */}
      {threadId && (
        <button
          onClick={loadThread}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border/40 hover:bg-accent/30 transition-colors"
        >
          {loading ? (
            "Loading discussion..."
          ) : (
            <>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide" : "View"} full discussion thread
            </>
          )}
        </button>
      )}

      {/* Thread view */}
      {expanded && thread && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-background/30">
          {Object.entries(roundGroups).map(([round, msgs]) => (
            <div key={round}>
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 font-medium">
                Round {round}
              </p>
              <div className="space-y-2">
                {msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded px-3 py-2 text-xs ${
                      msg.sender_type === "chief"
                        ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
                        : "bg-muted/30 text-foreground/80"
                    }`}
                  >
                    <p className="font-semibold mb-0.5">
                      {msg.sender_type === "chief"
                        ? "Chief Director"
                        : msg.specialist_role
                            ?.split("_")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                    </p>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Returns true if the content string is a team consultation synthesis. */
export function isConsultationSynthesis(content: string): boolean {
  return content.trimStart().startsWith("PRIMARY RECOMMENDATION:");
}
