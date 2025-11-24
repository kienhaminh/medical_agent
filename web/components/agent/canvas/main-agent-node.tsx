"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Brain, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const MainAgentNode = memo(({ data }: NodeProps) => {
  return (
    <div
      className="px-6 py-4 rounded-xl border-2 shadow-2xl min-w-[250px] max-w-[300px] transition-all hover:shadow-3xl bg-card"
      style={{
        borderColor: "#06b6d4",
        background: "linear-gradient(135deg, #06b6d408 0%, #14b8a625 100%)",
        boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="w-4 h-4"
        style={{ background: "#06b6d4" }}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-3 rounded-xl relative"
          style={{
            backgroundColor: "#06b6d420",
            boxShadow: "0 0 20px rgba(6, 182, 212, 0.2)",
          }}
        >
          <Brain className="w-6 h-6 text-cyan-500" />
          <Sparkles className="w-3 h-3 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-base bg-gradient-to-r from-cyan-400 to-teal-500 bg-clip-text text-transparent">
              Main Agent
            </h3>
            <Badge
              variant="outline"
              className="text-xs border-cyan-500/50 text-cyan-500"
            >
              Orchestrator
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            Central coordinator that analyzes queries and delegates to
            specialized sub-agents
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-500 font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
});

MainAgentNode.displayName = "MainAgentNode";
