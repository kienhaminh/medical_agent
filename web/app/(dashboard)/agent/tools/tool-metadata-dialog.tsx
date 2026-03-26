"use client";

import { useState, useEffect } from "react";
import { createTool, updateTool, type Tool } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Edit, Plus } from "lucide-react";
import { toast } from "sonner";

const TOOL_CATEGORIES = [
  { value: "medical", label: "Medical" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "research", label: "Research" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = { name: "", description: "", category: "medical" };

interface ToolMetadataDialogProps {
  mode: "create" | "edit";
  open: boolean;
  tool?: Tool | null;
  onClose: () => void;
  onSaved: (tool: Tool) => void;
}

export function ToolMetadataDialog({
  mode,
  open,
  tool,
  onClose,
  onSaved,
}: ToolMetadataDialogProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData(
      mode === "edit" && tool
        ? { name: tool.name, description: tool.description ?? "", category: tool.category ?? "medical" }
        : EMPTY_FORM
    );
  }, [open, mode, tool]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let saved: Tool;
      if (mode === "create") {
        saved = await createTool({
          ...formData,
          symbol: formData.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
          tool_type: "function",
        });
        toast.success("Tool created successfully");
      } else {
        if (!tool?.id) {
          toast.error("Tool ID is missing. Please refresh the page.");
          return;
        }
        saved = await updateTool(tool.id, formData);
        toast.success("Tool updated successfully");
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${mode === "create" ? "create" : "update"} tool`);
    } finally {
      setIsSaving(false);
    }
  }

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            {isCreate ? (
              <Sparkles className="w-6 h-6 text-cyan-500" />
            ) : (
              <Edit className="w-6 h-6 text-cyan-500" />
            )}
            {isCreate ? "Add New Tool" : "Edit Tool"}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a new AI tool to extend agent capabilities"
              : "Update tool information and settings"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="tool-name">Tool Name *</Label>
            <Input
              id="tool-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Medical Image Analyzer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-description">Description</Label>
            <Textarea
              id="tool-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this tool does..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="tool-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isCreate ? (
                <><Plus className="w-4 h-4 mr-2" />{isSaving ? "Creating..." : "Create Tool"}</>
              ) : (
                <><Edit className="w-4 h-4 mr-2" />{isSaving ? "Saving..." : "Save Changes"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
