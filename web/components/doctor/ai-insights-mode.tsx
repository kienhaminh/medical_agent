"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, TrendingUp, Lightbulb, X, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WSEvent } from "@/lib/ws-events";

interface InsightCard {
  id: string;
  type: "drug_interaction" | "suggested_order" | "lab_trend" | "clinical_reminder";
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  actions?: { label: string; action: string; data?: Record<string, unknown> }[];
}

interface AiInsightsModeProps {
  wsEvents: WSEvent[];
  onPlaceOrder?: (type: "lab" | "imaging", name: string) => void;
  onAskAi?: (question: string) => void;
}

const SEVERITY_STYLES = {
  info: "border-l-cyan-500 bg-cyan-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  critical: "border-l-red-500 bg-red-500/5",
};

const SEVERITY_ICONS = {
  info: Lightbulb,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

// Simple lab value pattern detection for inline insights
function parseLabInsights(resultNotes: string, orderName: string): InsightCard | null {
  const wbcMatch = resultNotes.match(/WBC\s*[:\s]*([\d.]+)/i);
  if (wbcMatch) {
    const wbc = parseFloat(wbcMatch[1]);
    if (wbc > 11.0) {
      return {
        id: `lab-wbc-${Date.now()}`,
        type: "lab_trend",
        title: "WBC Elevated",
        description: `WBC ${wbc} (ref <11.0) from ${orderName} — consider infection workup.`,
        severity: wbc > 20 ? "critical" : "warning",
        actions: [
          { label: "Order Blood Culture", action: "order", data: { type: "lab", name: "Blood Culture" } },
        ],
      };
    }
  }

  const tropMatch = resultNotes.match(/troponin\s*[:\s]*([\d.]+)/i);
  if (tropMatch) {
    const trop = parseFloat(tropMatch[1]);
    if (trop > 0.04) {
      return {
        id: `lab-trop-${Date.now()}`,
        type: "lab_trend",
        title: "Troponin Elevated",
        description: `Troponin ${trop} ng/mL (ref <0.04) — consider ACS workup.`,
        severity: trop > 0.4 ? "critical" : "warning",
        actions: [
          { label: "Order Serial Troponin", action: "order", data: { type: "lab", name: "Troponin (Serial)" } },
          { label: "Order ECG", action: "order", data: { type: "imaging", name: "ECG" } },
        ],
      };
    }
  }

  return null;
}

export function AiInsightsMode({ wsEvents, onPlaceOrder, onAskAi }: AiInsightsModeProps) {
  const [insights, setInsights] = useState<InsightCard[]>([]);

  // Generate insights from completed order events
  useEffect(() => {
    if (wsEvents.length === 0) return;
    const latest = wsEvents[wsEvents.length - 1];
    if (latest.type === "order.completed" && latest.payload.result_notes) {
      const insight = parseLabInsights(
        latest.payload.result_notes as string,
        latest.payload.order_name as string,
      );
      if (insight) {
        setInsights((prev) => [insight, ...prev]);
      }
    }
  }, [wsEvents]);

  const dismiss = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (action === "order" && data && onPlaceOrder) {
        onPlaceOrder(data.type as "lab" | "imaging", data.name as string);
      } else if (action === "ask" && data && onAskAi) {
        onAskAi(data.question as string);
      }
    },
    [onPlaceOrder, onAskAi],
  );

  return (
    <ScrollArea className="flex-1">
    <div className="p-3 space-y-2">
      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-cyan-500/60" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground/70">No active insights</p>
            <p className="text-[11px] text-muted-foreground/40">
              AI is monitoring your workflow
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[10px] text-cyan-500/60 font-mono">Watching</span>
          </div>
        </div>
      ) : (
        insights.map((insight) => {
          const SeverityIcon = SEVERITY_ICONS[insight.severity];
          return (
            <div
              key={insight.id}
              className={cn(
                "border border-border rounded-lg p-3 border-l-4",
                SEVERITY_STYLES[insight.severity],
              )}
            >
              <div className="flex items-start gap-2">
                <SeverityIcon
                  className={cn(
                    "h-4 w-4 shrink-0 mt-0.5",
                    insight.severity === "critical" && "text-red-500",
                    insight.severity === "warning" && "text-amber-500",
                    insight.severity === "info" && "text-cyan-500",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {insight.actions?.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => handleAction(action.action, action.data)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                        {action.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => onAskAi?.(`Tell me more about: ${insight.title}`)}
                    >
                      <MessageSquare className="h-2.5 w-2.5" />
                      Ask AI
                    </Button>
                  </div>
                </div>

                <button
                  onClick={() => dismiss(insight.id)}
                  className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
    </ScrollArea>
  );
}
