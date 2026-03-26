"use client";

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
import { Wrench, X, Plus, Code, Globe, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ToolCreatePanelProps } from "@/types/agent-ui";
import { useToolForm } from "../tools/use-tool-form";

export function ToolCreatePanel({
  isOpen,
  onClose,
  onSuccess,
}: ToolCreatePanelProps) {
  const {
    formData, setFormData,
    formError,
    testArgs, setTestArgs,
    testResult,
    isTesting,
    isSaving,
    handleNameChange,
    handleTest,
    handleSave,
  } = useToolForm({
    mode: "create",
    open: isOpen,
    tool: null,
    onClose,
    onSaved: () => { onSuccess(); },
  });

  if (!isOpen) return null;

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

      <form className="space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
        {formError && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
            {formError}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tool-name" className="text-sm">Tool Name *</Label>
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
          <Label htmlFor="tool-symbol" className="text-sm">Tool Symbol * (snake_case)</Label>
          <Input
            id="tool-symbol"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            placeholder="e.g., query_patient_tool"
            required
            className="h-9 font-mono text-sm"
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
          <Label htmlFor="tool-type" className="text-sm">Tool Type *</Label>
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
            <Label htmlFor="tool-code" className="text-sm">Function Code</Label>
            <Textarea
              id="tool-code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder={"def function():\n    # Your code here\n    pass"}
              className="min-h-[120px] resize-none font-mono text-sm"
            />
          </div>
        )}

        {formData.tool_type === "api" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="api-endpoint" className="text-sm">API Endpoint</Label>
              <Input
                id="api-endpoint"
                value={formData.api_endpoint}
                onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                placeholder="https://api.example.com/endpoint"
                className="h-9"
              />
            </div>

            {(
              [
                { field: "api_request_payload", label: "Request Schema (JSON)", placeholder: '{"param1": "value1"}' },
                { field: "api_response_payload", label: "Response Schema (JSON)", placeholder: '{"result": "value"}' },
                { field: "api_request_example", label: "Request Example (JSON)", placeholder: '{"param1": "example_value"}' },
                { field: "api_response_example", label: "Response Example (JSON)", placeholder: '{"result": "example_value"}' },
              ] as const
            ).map(({ field, label, placeholder }) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field} className="text-sm">{label}</Label>
                <Textarea
                  id={field}
                  value={formData[field]}
                  onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  placeholder={placeholder}
                  className="min-h-[80px] resize-none font-mono text-sm"
                />
              </div>
            ))}
          </>
        )}

        {/* Test section */}
        <div className="pt-4 border-t border-border/50">
          <Label className="text-sm font-medium mb-2 block">Test Tool</Label>
          <div className="space-y-2">
            <Label htmlFor="test-args" className="text-xs text-muted-foreground">
              Arguments (JSON)
            </Label>
            <Textarea
              id="test-args"
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              placeholder='{"arg1": "value1"}'
              className="min-h-[60px] resize-none font-mono text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
              className="w-full h-8"
            >
              <Play className="w-3 h-3 mr-2" />
              {isTesting ? "Running..." : "Run Test"}
            </Button>
            {testResult && (
              <div
                className={`p-2 rounded-md text-xs font-mono overflow-x-auto ${
                  testResult.status === "success"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                }`}
              >
                <pre>{testResult.status === "success" ? testResult.result : testResult.error}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Enable + actions */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="panel-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label htmlFor="panel-enabled" className="text-sm">Enable Tool</Label>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex-1 h-9"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSaving ? "Creating..." : "Save Tool"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
