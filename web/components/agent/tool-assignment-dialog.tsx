"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SubAgent, Tool } from "@/types/agent";
import { getTools, getAgentTools, bulkUpdateAgentTools } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ToolAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: SubAgent;
  onSuccess: () => void;
}

export function ToolAssignmentDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: ToolAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, agent.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tools, assignedTools] = await Promise.all([
        getTools(),
        getAgentTools(agent.id),
      ]);

      setAllTools(tools);
      setSelectedTools(new Set(assignedTools.map((t) => t.name)));
    } catch (error) {
      toast.error("Failed to load tools");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTool = (toolName: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName);
    } else {
      newSelected.add(toolName);
    }
    setSelectedTools(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await bulkUpdateAgentTools(agent.id, Array.from(selectedTools));
      toast.success("Tool assignments updated");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update tool assignments");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // Filter tools: assignable or both
  const assignableTools = allTools.filter(
    (t) => t.scope === "assignable" || t.scope === "both"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Tools - {agent.name}</DialogTitle>
          <DialogDescription>
            Select which tools this agent can use
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {assignableTools.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No assignable tools available
              </p>
            ) : (
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {assignableTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-3 rounded-lg border p-4 hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleToggleTool(tool.name)}
                  >
                    <Checkbox
                      checked={selectedTools.has(tool.name)}
                      onCheckedChange={() => handleToggleTool(tool.name)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tool.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {tool.scope}
                        </Badge>
                        {tool.category && (
                          <Badge variant="secondary" className="text-xs">
                            {tool.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Selected: {selectedTools.size} / {assignableTools.length}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
