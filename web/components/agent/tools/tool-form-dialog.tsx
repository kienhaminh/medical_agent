// web/components/agent/tools/tool-form-dialog.tsx
"use client";

import type { Tool } from "@/lib/api";
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
import { Sparkles, Edit, Play, AlignLeft } from "lucide-react";
import { useToolForm } from "./use-tool-form";

interface ToolFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  tool?: Tool | null;
  onClose: () => void;
  onSaved: (tool: Tool) => void;
}

export function ToolFormDialog({ mode, open, tool, onClose, onSaved }: ToolFormDialogProps) {
  const {
    formData, setFormData, formError,
    testArgs, setTestArgs, testResult,
    isTesting, isSaving,
    handleNameChange, handleFormatJSON, handleTest, handleSave, formatJsonForDisplay,
  } = useToolForm({ mode, open, tool, onClose, onSaved });

  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreate ? <Sparkles className="w-5 h-5 text-cyan-500" /> : <Edit className="w-5 h-5 text-cyan-500" />}
            {isCreate ? "Add New Tool" : "Edit Tool"}
          </DialogTitle>
          <DialogDescription>
            {isCreate ? "Create a new AI tool to extend agent capabilities" : "Update tool information and settings"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {formError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
              {formError}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="tool-name">Tool Name *</Label>
            {isCreate ? (
              <Input id="tool-name" required value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g., Query Patient Tool" />
            ) : (
              <>
                <Input id="tool-name" value={formData.name} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Tool name cannot be changed</p>
              </>
            )}
          </div>

          {/* Symbol */}
          <div className="space-y-2">
            <Label htmlFor="tool-symbol">Tool Symbol * (snake_case)</Label>
            {isCreate ? (
              <Input id="tool-symbol" required value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} placeholder="e.g., query_patient_tool" className="font-mono text-sm" />
            ) : (
              <>
                <Input id="tool-symbol" value={formData.symbol} disabled className="font-mono text-sm bg-muted" />
                <p className="text-xs text-muted-foreground">Tool symbol cannot be changed</p>
              </>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="tool-description">Description</Label>
            <Textarea id="tool-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe what this tool does..." className="min-h-[100px]" />
          </div>

          {/* Tool Type */}
          <div className="space-y-2">
            <Label htmlFor="tool-type">Tool Type *</Label>
            <Select value={formData.tool_type} onValueChange={(v: "function" | "api") => setFormData({ ...formData, tool_type: v })}>
              <SelectTrigger id="tool-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="function">Function</SelectItem>
                <SelectItem value="api">API Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Function code */}
          {formData.tool_type === "function" && (
            <div className="space-y-2">
              <Label htmlFor="tool-code">Function Code</Label>
              <Textarea id="tool-code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder={"def function():\n    # Your code here\n    pass"} className="min-h-[120px] font-mono text-sm" />
            </div>
          )}

          {/* API fields */}
          {formData.tool_type === "api" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input id="api-endpoint" value={formData.api_endpoint} onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })} placeholder="https://api.example.com/endpoint" />
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
                  <div className="flex items-center justify-between">
                    <Label>{label}</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleFormatJSON(field)} className="h-7 px-2 text-xs">
                      <AlignLeft className="w-3 h-3 mr-1" />Format JSON
                    </Button>
                  </div>
                  <Textarea value={formData[field]} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} placeholder={placeholder} className="min-h-[80px] font-mono text-sm" />
                </div>
              ))}
            </>
          )}

          {/* Test section */}
          <div className="pt-4 border-t border-border/50">
            <Label className="text-sm font-medium mb-2 block">Test Tool</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="test-args" className="text-xs text-muted-foreground">Arguments (JSON)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFormatJSON("test_args")} className="h-7 px-2 text-xs">
                  <AlignLeft className="w-3 h-3 mr-1" />Format JSON
                </Button>
              </div>
              <Textarea id="test-args" value={testArgs} onChange={(e) => setTestArgs(e.target.value)} placeholder='{"arg1": "value1"}' className="min-h-[60px] resize-none font-mono text-xs" />
              <Button type="button" variant="secondary" size="sm" onClick={handleTest} disabled={isTesting} className="w-full h-8">
                <Play className="w-3 h-3 mr-2" />
                {isTesting ? "Running..." : "Run Test"}
              </Button>
              {testResult && (
                <div className={`p-2 rounded-md text-xs font-mono overflow-x-auto ${testResult.status === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
                  <pre>{formatJsonForDisplay(testResult.status === "success" ? testResult.result : testResult.error)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : isCreate ? "Save Tool" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
