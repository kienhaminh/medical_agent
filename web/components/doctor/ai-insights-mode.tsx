"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Lightbulb, X, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface InsightCard {
  id: string;
  type: "drug_interaction" | "suggested_order" | "lab_trend" | "clinical_reminder";
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  actions?: { label: string; action: string; data?: Record<string, unknown> }[];
}

interface AiInsightsModeProps {
  onAskAi?: (question: string) => void;
}

const SEVERITY_STYLES = {
  info: "border-l-primary bg-primary/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  critical: "border-l-red-500 bg-red-500/5",
};

const SEVERITY_ICONS = {
  info: Lightbulb,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

export function AiInsightsMode({ onAskAi }: AiInsightsModeProps) {
  const [insights, setInsights] = useState<InsightCard[]>([]);

  const dismiss = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (action === "ask" && data && onAskAi) {
        onAskAi(data.question as string);
      }
    },
    [onAskAi],
  );

  return (
    <ScrollArea className="flex-1">
    <div className="p-3 space-y-2">
      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary/60" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground/70">No active insights</p>
            <p className="text-[11px] text-muted-foreground/40">
              AI is monitoring your workflow
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-primary/60 font-mono">Watching</span>
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
                    insight.severity === "info" && "text-primary",
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
