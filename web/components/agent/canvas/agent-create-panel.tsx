"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Bot, X, Plus } from "lucide-react";
import { createAgent } from "@/lib/api";
import type { SubAgentCreate } from "@/types/agent";
import type { AgentCreatePanelProps } from "@/types/agent-ui";

export function AgentCreatePanel({
  isOpen,
  onClose,
  onSuccess,
}: AgentCreatePanelProps) {
  const [formData, setFormData] = useState<SubAgentCreate>({
    name: "",
    role: "",
    description: "",
    system_prompt: "",
    color: "#06b6d4",
    icon: "Bot",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createAgent(formData);
      setFormData({
        name: "",
        role: "",
        description: "",
        system_prompt: "",
        color: "#06b6d4",
        icon: "Bot",
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create agent:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="absolute top-4 right-4 w-80 p-4 bg-card/95 backdrop-blur-sm shadow-xl border-border/50 z-10 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-500" />
          <h3 className="font-semibold">Create Agent</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="agent-name" className="text-sm">
            Name *
          </Label>
          <Input
            id="agent-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Imaging Specialist"
            required
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-role" className="text-sm">
            Role *
          </Label>
          <Input
            id="agent-role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="e.g., imaging"
            required
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-description" className="text-sm">
            Description *
          </Label>
          <Textarea
            id="agent-description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Brief description of the agent's purpose..."
            required
            className="min-h-[60px] resize-none text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-prompt" className="text-sm">
            System Prompt *
          </Label>
          <Textarea
            id="agent-prompt"
            value={formData.system_prompt}
            onChange={(e) =>
              setFormData({ ...formData, system_prompt: e.target.value })
            }
            placeholder="Instructions for the agent..."
            required
            className="min-h-[80px] resize-none text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-color" className="text-sm">
            Color
          </Label>
          <div className="flex gap-2">
            <Input
              id="agent-color"
              type="color"
              value={formData.color}
              onChange={(e) =>
                setFormData({ ...formData, color: e.target.value })
              }
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <Input
              value={formData.color}
              onChange={(e) =>
                setFormData({ ...formData, color: e.target.value })
              }
              placeholder="#06b6d4"
              className="flex-1 h-9 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 h-9"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-9 primary-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
