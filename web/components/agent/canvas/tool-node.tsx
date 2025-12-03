"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { Tool } from "@/lib/api";
import { Wrench, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ToolNode = memo(({ data }: NodeProps) => {
  const tool = data as unknown as Tool;

  const DISCONNECTED_COLOR = "#6b7280";
  const DISABLED_COLOR = "#ef4444";

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      medical: "#10b981",
      diagnostic: "#f59e0b",
      research: "#8b5cf6",
      communication: "#06b6d4",
      other: DISCONNECTED_COLOR,
    };
    return colors[category || "other"] || DISCONNECTED_COLOR;
  };

  const color = getCategoryColor(tool.category);
  const isConnected = !!tool.assigned_agent_id;
  const isEnabled = tool.enabled !== false; // Default to true if not specified
  const displayColor = isConnected ? color : DISCONNECTED_COLOR;

  // If disabled, override styling
  const finalColor = isEnabled ? displayColor : DISABLED_COLOR;
  const finalOpacity = !isEnabled ? 0.4 : isConnected ? 1 : 0.5;

  return (
    <div
      className="px-4 py-3 rounded-lg border-2 min-w-[180px] max-w-[250px] bg-card relative"
      style={{
        borderColor: finalColor,
        borderStyle: isEnabled ? "solid" : "dashed",
        background: isEnabled
          ? isConnected
            ? `linear-gradient(135deg, ${color}15 0%, ${color}30 100%)`
            : `linear-gradient(135deg, ${DISCONNECTED_COLOR}05 0%, ${DISCONNECTED_COLOR}08 100%)`
          : `linear-gradient(135deg, ${DISABLED_COLOR}08 0%, ${DISABLED_COLOR}15 100%)`,
        opacity: finalOpacity,
        boxShadow: isEnabled
          ? isConnected
            ? `0 0 20px ${color}40, 0 0 40px ${color}20, 0 4px 12px rgba(0,0,0,0.15)`
            : "0 2px 8px rgba(0,0,0,0.08)"
          : `0 0 15px ${DISABLED_COLOR}30`,
        transform: isConnected && isEnabled ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        filter: isEnabled ? "none" : "grayscale(0.5)",
      }}
    >
      {/* Disabled strikethrough effect */}
      {!isEnabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              ${DISABLED_COLOR}10 10px,
              ${DISABLED_COLOR}10 12px
            )`,
            borderRadius: "0.5rem",
          }}
        />
      )}

      <Handle
        type="source"
        position={Position.Left}
        className="w-3 h-3"
        style={{
          background: finalColor,
          opacity: isEnabled ? 1 : 0.6,
        }}
        isConnectable={isEnabled}
      />

      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg transition-all duration-800 relative"
          style={{
            backgroundColor: isEnabled
              ? isConnected
                ? `${displayColor}30`
                : `${displayColor}15`
              : `${DISABLED_COLOR}20`,
            boxShadow:
              isEnabled && isConnected ? `0 0 12px ${color}30` : "none",
          }}
        >
          {isEnabled ? (
            <Wrench
              className="w-4 h-4 transition-all duration-800"
              style={{
                color: displayColor,
                filter: isConnected ? "brightness(1.2)" : "brightness(0.8)",
              }}
            />
          ) : (
            <Ban
              className="w-4 h-4 transition-all duration-800"
              style={{
                color: DISABLED_COLOR,
              }}
            />
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            {tool.name}
            {!isEnabled && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Disabled
              </Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {tool.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {tool.category && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: finalColor,
                  color: finalColor,
                }}
              >
                {tool.category}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ToolNode.displayName = "ToolNode";
