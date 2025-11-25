"use client";

import { useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Wrench, X, Plus, Code, Globe } from "lucide-react";
import { createTool } from "@/lib/api";
import type { ToolCreatePanelProps } from "@/types/agent-ui";

export function ToolCreatePanel({
  isOpen,
  onClose,
  onSuccess,
}: ToolCreatePanelProps) {
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    tool_type: "function" as "function" | "api",
    code: "",
    api_endpoint: "",
    api_request_payload: "",
    api_response_payload: "",
    scope: "assignable",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-generate symbol from name
  const handleNameChange = (name: string) => {
    const symbol = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setFormData({ ...formData, name, symbol });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await createTool(formData);
      setFormData({
        name: "",
        symbol: "",
        description: "",
        tool_type: "function",
        code: "",
        api_endpoint: "",
        api_request_payload: "",
        api_response_payload: "",
        scope: "assignable",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to create tool:", error);
      const errorMessage = error?.message || "Failed to create tool";

      // Check if it's a duplicate symbol error
      if (errorMessage.includes("symbol") && errorMessage.includes("already exists")) {
        setError("Choose another symbol name for tool");
      } else {
        setError(errorMessage);
      }
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
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tool-name" className="text-sm">
            Tool Name *
          </Label>
          <Input
            id="tool-name"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Query Patient Tool"
            required
            className="h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-symbol" className="text-sm">
            Tool Symbol * (snake_case)
          </Label>
          <Input
            id="tool-symbol"
            value={formData.symbol}
            onChange={(e) =>
              setFormData({ ...formData, symbol: e.target.value })
            }
            placeholder="e.g., query_patient_tool"
            required
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-description" className="text-sm">
            Description *
          </Label>
          <Textarea
            id="tool-description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Describe what this tool does..."
            required
            className="min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-type" className="text-sm">
            Tool Type *
          </Label>
          <Select
            value={formData.tool_type}
            onValueChange={(value: "function" | "api") =>
              setFormData({ ...formData, tool_type: value })
            }
          >
            <SelectTrigger id="tool-type" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="function">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  <span>Function</span>
                </div>
              </SelectItem>
              <SelectItem value="api">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>API Call</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.tool_type === "function" && (
          <div className="space-y-2">
            <Label htmlFor="tool-code" className="text-sm">
              Function Code
            </Label>
            <Textarea
              id="tool-code"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value })
              }
              placeholder="def function():\n    # Your code here\n    pass"
              className="min-h-[120px] resize-none font-mono text-sm"
            />
          </div>
        )}

        {formData.tool_type === "api" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="api-endpoint" className="text-sm">
                API Endpoint
              </Label>
              <Input
                id="api-endpoint"
                value={formData.api_endpoint}
                onChange={(e) =>
                  setFormData({ ...formData, api_endpoint: e.target.value })
                }
                placeholder="https://api.example.com/endpoint"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-request" className="text-sm">
                Request Payload (JSON)
              </Label>
              <Textarea
                id="api-request"
                value={formData.api_request_payload}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    api_request_payload: e.target.value,
                  })
                }
                placeholder='{"param1": "value1"}'
                className="min-h-[80px] resize-none font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-response" className="text-sm">
                Response Payload (JSON)
              </Label>
              <Textarea
                id="api-response"
                value={formData.api_response_payload}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    api_response_payload: e.target.value,
                  })
                }
                placeholder='{"result": "value"}'
                className="min-h-[80px] resize-none font-mono text-sm"
              />
            </div>
          </>
        )}

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
