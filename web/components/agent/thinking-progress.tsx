"use client";

import { SubAgentConsultationItem } from "./sub-agent-consultation";
import type {
  LogItem,
  ThinkingProgressProps,
  SubAgentConsultation,
} from "@/types/agent-ui";

function formatLogMessage(log: LogItem): string {
  if (typeof log.message === "string" && log.message.trim().length > 0) {
    return log.message;
  }

  if (typeof log.content === "string") {
    return log.content;
  }

  if (log.content && typeof log.content === "object") {
    const content = log.content as Record<string, unknown>;
    const source =
      content["result"] ??
      content["output"] ??
      content["message"] ??
      content["content"] ??
      content["args"];
    const serialized =
      typeof source === "string"
        ? source
        : source !== undefined
        ? JSON.stringify(source)
        : JSON.stringify(content);
    const labelCandidate = content["tool"] ?? content["name"];
    const label =
      typeof labelCandidate === "string" && labelCandidate.trim().length > 0
        ? labelCandidate
        : undefined;

    return label ? `[${label}] ${serialized}` : serialized;
  }

  if (log.type) {
    return `[${log.type}]`;
  }

  return JSON.stringify(log);
}

function formatLogMeta(log: LogItem): string | undefined {
  if (log.duration) return log.duration;

  if (log.timestamp) {
    const date = new Date(log.timestamp);
    return Number.isNaN(date.getTime())
      ? log.timestamp
      : date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
  }

  return undefined;
}

function parseSubAgentConsultations(reasoning: string): {
  regularContent: string;
  consultations: SubAgentConsultation[];
} {
  // Check if reasoning contains sub-agent consultations or reports
  const hasConsult =
    /CONSULT:/i.test(reasoning) || /REPORT FROM SPECIALIST/i.test(reasoning);

  if (!hasConsult) {
    return { regularContent: reasoning, consultations: [] };
  }

  const consultations: SubAgentConsultation[] = [];
  let regularContent = "";

  // Split by sub-agent responses (marked with **[AgentName]** or REPORT FROM SPECIALIST **[AgentName]**)
  // We look for the start of a report block
  const parts = reasoning.split(
    /(REPORT FROM SPECIALIST \*\*\[[^\]]+\]\*\*:|\*\*\[[^\]]+\]\*\*:)/
  );

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Check if this is an agent tag
    const agentMatch = part.match(
      /REPORT FROM SPECIALIST \*\*\[([^\]]+)\]\*\*:| \*\*\[([^\]]+)\]\*\*:/
    );
    if (agentMatch && i + 1 < parts.length) {
      const agentName = agentMatch[1] || agentMatch[2];
      const agentResponse = parts[i + 1].trim();
      consultations.push({
        agent: agentName,
        response: agentResponse,
      });
      i++; // Skip the next part since we consumed it
    } else if (!agentMatch && !part.match(/CONSULT:/i)) {
      // Regular reasoning content (not CONSULT prefix)
      regularContent += part + "\n";
    }
  }

  return { regularContent: regularContent.trim(), consultations };
}

export function ThinkingProgress({
  reasoning,
  logs = [],
}: ThinkingProgressProps) {
  const { regularContent, consultations } =
    parseSubAgentConsultations(reasoning);

  return (
    <div className="space-y-3">
      {/* Logs */}
      {logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map((log, idx) => {
            const message = formatLogMessage(log);
            const meta = formatLogMeta(log);
            const badge =
              log.type && log.type !== "log"
                ? log.type.replace(/_/g, " ")
                : null;

            return (
              <div
                key={idx}
                className="flex items-start justify-between text-xs font-mono group"
              >
                <span
                  className={`text-muted-foreground/80 ${
                    log.level === "error" ? "text-red-400" : ""
                  } flex items-center gap-2`}
                >
                  <span className="opacity-50">›</span>
                  {badge && (
                    <span className="uppercase tracking-widest text-[9px] text-muted-foreground/70 border border-border/40 rounded px-1 py-0.5">
                      {badge}
                    </span>
                  )}
                  <span className="leading-relaxed">{message}</span>
                </span>
                {meta && (
                  <span className="text-muted-foreground/40 text-[10px] ml-2 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {meta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Regular reasoning content */}
      {regularContent && (
        <div className="text-xs text-muted-foreground/90 whitespace-pre-wrap font-mono leading-relaxed bg-muted/30 p-3 rounded-md border border-cyan-500/30">
          {regularContent}
        </div>
      )}

      {/* Sub-agent consultations */}
      {consultations.length > 0 && (
        <div className="space-y-2 pt-1">
          {consultations.map((consultation, idx) => (
            <SubAgentConsultationItem key={idx} consultation={consultation} />
          ))}
        </div>
      )}
    </div>
  );
}
