"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubAgent, SubAgentCreate, SubAgentUpdate } from "@/types/agent";
import { createAgent, updateAgent } from "@/lib/api";
import { toast } from "sonner";

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: SubAgent;
  onSuccess: () => void;
}

export function AgentFormDialog({
  open,
  onOpenChange,
  agent,
  onSuccess,
}: AgentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    description: "",
    system_prompt: "",
    color: "#06b6d4",
    icon: "Bot",
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        system_prompt: agent.system_prompt,
        color: agent.color,
        icon: agent.icon,
      });
    } else {
      setFormData({
        name: "",
        role: "",
        description: "",
        system_prompt: "",
        color: "#06b6d4",
        icon: "Bot",
      });
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (agent) {
        await updateAgent(agent.id, formData as SubAgentUpdate);
        toast.success("Agent updated successfully");
      } else {
        await createAgent(formData as SubAgentCreate);
        toast.success("Agent created successfully");
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save agent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "Create Agent"}</DialogTitle>
          <DialogDescription>
            {agent
              ? "Update agent configuration and system prompt"
              : "Create a new AI specialist agent"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Radiologist"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                placeholder="e.g., imaging"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of what this agent does"
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="system_prompt">System Prompt</Label>
            <Textarea
              id="system_prompt"
              value={formData.system_prompt}
              onChange={(e) =>
                setFormData({ ...formData, system_prompt: e.target.value })
              }
              placeholder="Detailed instructions for the agent..."
              rows={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              This defines how the agent behaves and what it can do
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="color">Color (Hex)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="#06b6d4"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon Name</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                placeholder="e.g., Bot, Brain, Activity"
              />
              <p className="text-xs text-muted-foreground">
                Lucide icon name
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : agent ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
