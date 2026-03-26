"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Code, Globe } from "lucide-react";
import type { Tool } from "@/lib/api";

interface ToolsTabToolCardProps {
  tool: Tool;
  onToggle: (tool: Tool, enabled: boolean) => void;
  onEdit: (tool: Tool) => void;
  onDelete: (tool: Tool) => void;
}

export function ToolsTabToolCard({ tool, onToggle, onEdit, onDelete }: ToolsTabToolCardProps) {
  return (
    <Card
      key={tool.name}
      className="group p-4 transition-all hover:shadow-md border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
            {tool.tool_type === "function" ? (
              <Code className="w-4 h-4 text-cyan-500" />
            ) : (
              <Globe className="w-4 h-4 text-cyan-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-base">{tool.name}</h3>
            <div className="flex flex-col gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs font-mono">
                {tool.symbol}
              </Badge>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    tool.tool_type === "function"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                      : "bg-purple-500/10 text-purple-500 border-purple-500/30"
                  }`}
                >
                  {tool.tool_type === "function" ? "Function" : "API"}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    tool.enabled
                      ? "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
                      : "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
                  }`}
                >
                  {tool.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={tool.enabled}
            onCheckedChange={(checked) => onToggle(tool, checked)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {tool.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {tool.description}
        </p>
      )}

      <div className="flex items-center justify-end mt-auto pt-3 border-t border-border/50">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(tool)}
            className="hover:bg-cyan-500/10 hover:text-cyan-500 h-8 w-8"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(tool)}
            className="hover:bg-red-500/10 hover:text-red-500 h-8 w-8"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
