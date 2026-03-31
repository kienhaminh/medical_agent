"use client";

import { Badge } from "@/components/ui/badge";

interface AgentConfig {
  name: string;
  role: string;
  description: string;
  color: string;
  icon: string;
  is_template: boolean;
  tools: string[];
}

interface AgentCardProps {
  agent: AgentConfig;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <div
      className="rounded-lg border bg-card p-4 flex flex-col gap-2"
      style={{ borderColor: `${agent.color}33` }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm">{agent.name}</h3>
        <Badge variant="outline" className="text-xs shrink-0">
          {agent.role.replace(/_/g, " ")}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
      {agent.tools.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tools: {agent.tools.join(", ")}
        </p>
      )}
    </div>
  );
}
