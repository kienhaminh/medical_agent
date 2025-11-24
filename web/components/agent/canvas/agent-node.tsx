"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { SubAgent } from "@/types/agent";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AgentNode = memo(({ data }: NodeProps) => {
  const agent = data as unknown as SubAgent;

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px] max-w-[280px] transition-all hover:shadow-xl bg-card"
      style={{
        borderColor: agent.color || "#06b6d4",
        background: `linear-gradient(135deg, ${
          agent.color || "#06b6d4"
        }08 0%, ${agent.color || "#06b6d4"}15 100%)`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3"
        style={{ background: agent.color || "#06b6d4" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
        style={{ background: agent.color || "#06b6d4" }}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${agent.color || "#06b6d4"}20` }}
        >
          <Bot
            className="w-5 h-5"
            style={{ color: agent.color || "#06b6d4" }}
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
              borderColor: agent.color || "#06b6d4",
              color: agent.color || "#06b6d4",
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
