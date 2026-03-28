"use client";

import { useState } from "react";
import {
  UserRoundSearch,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import type { AgentInfo } from "@/lib/api";

interface ConsultResult {
  specialist: AgentInfo;
  response: string;
  timestamp: Date;
}

interface SpecialistConsultPanelProps {
  specialists: AgentInfo[];
  onConsult: (specialist: AgentInfo, question: string) => Promise<string>;
  disabled?: boolean;
}

/**
 * Panel that lets a doctor select a specialist agent (Cardiologist,
 * Neurologist, Pulmonologist, etc.) and ask a clinical question.
 * Results are collected in a collapsible accordion below the input.
 */
export function SpecialistConsultPanel({
  specialists,
  onConsult,
  disabled,
}: SpecialistConsultPanelProps) {
  const [selected, setSelected] = useState<AgentInfo | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ConsultResult[]>([]);
  // Index of the accordion item that is currently expanded (null = all collapsed)
  const [openResult, setOpenResult] = useState<number | null>(0);

  const handleConsult = async () => {
    if (!selected || !question.trim() || loading) return;
    const q = question.trim();
    setLoading(true);
    try {
      const response = await onConsult(selected, q);
      setResults((prev) => [
        { specialist: selected, response, timestamp: new Date() },
        ...prev,
      ]);
      setQuestion("");
      // Automatically open the newest result
      setOpenResult(0);
    } catch (e) {
      console.error("Consult failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 border-b border-border">
        <UserRoundSearch className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">Specialist Consult</span>
      </div>

      <div className="p-3 space-y-2">
        {/* Specialist selector chips */}
        <div className="flex flex-wrap gap-1.5">
          {specialists.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              disabled={disabled || loading}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors disabled:opacity-50 ${
                selected?.id === s.id
                  ? "text-white border-transparent"
                  : "text-muted-foreground border-border hover:border-foreground"
              }`}
              // Dynamic background color only applied when selected; not expressible as Tailwind class
              style={
                selected?.id === s.id
                  ? { backgroundColor: s.color, borderColor: s.color }
                  : {}
              }
            >
              {s.name.replace(" Consultant", "")}
            </button>
          ))}
        </div>

        {/* Question input — only visible once a specialist is selected */}
        {selected && (
          <div className="flex gap-2">
            <input
              className="flex-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`Ask ${selected.name}...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleConsult();
                }
              }}
              disabled={loading || disabled}
            />
            <button
              onClick={handleConsult}
              disabled={loading || !question.trim() || disabled}
              className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Consult results accordion */}
      {results.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {results.map((r, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenResult(openResult === i ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
              >
                <span
                  className="font-medium"
                  // Dynamic text color matching the specialist's config color
                  style={{ color: r.specialist.color }}
                >
                  {r.specialist.name}
                </span>
                {openResult === i ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {openResult === i && (
                <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {r.response}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {specialists.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No specialist agents available
        </p>
      )}
    </div>
  );
}
