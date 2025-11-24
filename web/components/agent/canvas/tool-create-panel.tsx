"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Wrench, X, Plus } from "lucide-react";
import { createTool } from "@/lib/api";

const toolCategories = [
  { value: "medical", label: "Medical" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "research", label: "Research" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

interface ToolCreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ToolCreatePanel({ isOpen, onClose, onSuccess }: ToolCreatePanelProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "medical",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createTool(formData);
      setFormData({ name: "", description: "", category: "medical" });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create tool:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="absolute top-4 left-4 w-80 p-4 bg-card/95 backdrop-blur-sm shadow-xl border-border/50 z-10 animate-in slide-in-from-left-4 duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-cyan-500" />
          <h3 className="font-semibold">Create Tool</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tool-name" className="text-sm">Tool Name *</Label>
          <Input
            id="tool-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Patient Data Analyzer"
            required
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-description" className="text-sm">Description *</Label>
          <Textarea
            id="tool-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe what this tool does..."
            required
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-category" className="text-sm">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger id="tool-category" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toolCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
