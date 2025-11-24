"use client";

import { SubAgentConsultationItem, type SubAgentConsultation } from "./sub-agent-consultation";

export interface LogItem {
  message: string;
  duration?: string;
  level?: "info" | "warning" | "error";
}

interface ThinkingProgressProps {
  reasoning: string;
  logs?: LogItem[];
}

function parseSubAgentConsultations(reasoning: string): {
  regularContent: string;
  consultations: SubAgentConsultation[];
} {
  // Check if reasoning contains sub-agent consultations or reports
  const hasConsult = /CONSULT:/i.test(reasoning) || /REPORT FROM SPECIALIST/i.test(reasoning);

  if (!hasConsult) {
    return { regularContent: reasoning, consultations: [] };
  }

  const consultations: SubAgentConsultation[] = [];
  let regularContent = "";

  // Split by sub-agent responses (marked with **[AgentName]** or REPORT FROM SPECIALIST **[AgentName]**)
  // We look for the start of a report block
  const parts = reasoning.split(/(REPORT FROM SPECIALIST \*\*\[[^\]]+\]\*\*:|\*\*\[[^\]]+\]\*\*:)/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Check if this is an agent tag
    const agentMatch = part.match(/REPORT FROM SPECIALIST \*\*\[([^\]]+)\]\*\*:| \*\*\[([^\]]+)\]\*\*:/);
    if (agentMatch && i + 1 < parts.length) {
      const agentName = agentMatch[1] || agentMatch[2];
      const agentResponse = parts[i + 1].trim();
      consultations.push({
        agent: agentName,
        response: agentResponse
      });
      i++; // Skip the next part since we consumed it
    } else if (!agentMatch && !part.match(/CONSULT:/i)) {
      // Regular reasoning content (not CONSULT prefix)
      regularContent += part + "\n";
    }
  }

  return { regularContent: regularContent.trim(), consultations };
}

export function ThinkingProgress({ reasoning, logs = [] }: ThinkingProgressProps) {
  const { regularContent, consultations } = parseSubAgentConsultations(reasoning);

  return (
    <div className="space-y-3">
      {/* Logs */}
      {logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start justify-between text-xs font-mono group">
              <span className={`text-muted-foreground/80 ${log.level === 'error' ? 'text-red-400' : ''}`}>
                <span className="opacity-50 mr-2">›</span>
                {log.message}
              </span>
              {log.duration && (
                <span className="text-muted-foreground/40 text-[10px] ml-2 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {log.duration}
                </span>
              )}
            </div>
          ))}
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
