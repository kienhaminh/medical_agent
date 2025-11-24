"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Tool } from "@/lib/api";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ToolNode = memo(({ data }: NodeProps) => {
  const tool = data as unknown as Tool;

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      medical: "#10b981",
      diagnostic: "#f59e0b",
      research: "#8b5cf6",
      communication: "#06b6d4",
      other: "#6b7280",
    };
    return colors[category || "other"] || "#6b7280";
  };

  const color = getCategoryColor(tool.category);

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px] max-w-[250px] transition-all hover:shadow-xl bg-card"
      style={{
        borderColor: tool.enabled ? color : "#6b7280",
        background: tool.enabled
          ? `linear-gradient(135deg, ${color}08 0%, ${color}18 100%)`
          : "linear-gradient(135deg, #f3f4f608 0%, #f3f4f610 100%)",
        opacity: tool.enabled ? 1 : 0.6,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3"
        style={{ background: color }}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Wrench className="w-4 h-4" style={{ color }} />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">{tool.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {tool.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {tool.category && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: color,
                  color: color,
                }}
              >
                {tool.category}
              </Badge>
            )}
            {!tool.enabled && (
              <Badge variant="secondary" className="text-xs h-5">
                Disabled
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ToolNode.displayName = "ToolNode";
