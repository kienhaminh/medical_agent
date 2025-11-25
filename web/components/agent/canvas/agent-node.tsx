"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { SubAgent } from "@/types/agent";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AgentNode = memo(({ data }: NodeProps) => {
  const agent = data as unknown as SubAgent;

  const getRoleColor = (role?: string) => {
    const colors: Record<string, string> = {
      imaging: "#06b6d4",
      lab_results: "#10b981",
      drug_interaction: "#f59e0b",
      clinical_text: "#8b5cf6",
      diagnostic: "#ef4444",
      research: "#3b82f6",
      communication: "#14b8a6",
    };
    return colors[role || ""] || agent.color || "#8b5cf6";
  };

  const color = getRoleColor(agent.role);

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px] max-w-[280px] transition-all hover:shadow-xl bg-card"
      style={{
        borderColor: color,
        background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3"
        style={{ background: color }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
        style={{ background: color }}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Bot
            className="w-5 h-5"
            style={{ color: color }}
          />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm">{agent.name}</h3>
            {!agent.enabled && (
              <Badge variant="secondary" className="text-xs h-5">
                Disabled
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
          <Badge
            variant="outline"
            className="mt-2 text-xs"
            style={{
              borderColor: color,
              color: color,
            }}
          >
            {agent.role}
          </Badge>
        </div>
      </div>
    </div>
  );
});

AgentNode.displayName = "AgentNode";
