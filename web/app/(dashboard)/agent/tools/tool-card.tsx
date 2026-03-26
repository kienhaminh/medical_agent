"use client";

import { type Tool } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Power, Edit, Trash2 } from "lucide-react";

interface ToolCardProps {
  tool: Tool;
  onToggle: (id: number, currentEnabled: boolean) => void;
  onEdit: (tool: Tool) => void;
  onDelete: (tool: Tool) => void;
}

export function ToolCard({ tool, onToggle, onEdit, onDelete }: ToolCardProps) {
  return (
    <Card
      className={`record-card group p-5 ${
        tool.enabled
          ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"
          : "opacity-75"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              tool.enabled
                ? "bg-cyan-500/10 group-hover:bg-cyan-500/20"
                : "bg-muted"
            } transition-colors`}
          >
            <Wrench
              className={`w-5 h-5 ${
                tool.enabled ? "text-cyan-500" : "text-muted-foreground"
              }`}
            />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{tool.name}</h3>
            {tool.category && (
              <Badge variant="clinical" className="mt-1 text-xs">
                {tool.category}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {tool.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {tool.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(tool.id, tool.enabled ?? false)}
            className={`p-2 rounded-lg transition-all ${
              tool.enabled
                ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            title={tool.enabled ? "Disable Tool" : "Enable Tool"}
          >
            <Power className="w-4 h-4" />
          </button>
          <Badge
            variant="secondary"
            className={
              tool.enabled
                ? "bg-green-500/10 text-green-500 border-green-500/30"
                : "bg-muted"
            }
          >
            {tool.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(tool)}
            className="hover:bg-cyan-500/10 hover:text-cyan-500"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(tool)}
            className="hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
