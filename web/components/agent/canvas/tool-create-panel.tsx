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
import { Wrench, X, Plus, Code, Globe, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createTool, testTool } from "@/lib/api";
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
    api_request_example: "",
    api_response_payload: "",
    api_response_example: "",
    enabled: false,
    test_passed: false,
    scope: "assignable" as "global" | "assignable" | "both",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test state
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<{
    status: string;
    result?: string;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  // Auto-generate symbol from name
  const handleNameChange = (name: string) => {
    const symbol = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setFormData({ ...formData, name, symbol });
  };

  async function handleTest() {
    try {
      setIsTesting(true);
      setTestResult(null);

      let args = {};
      try {
        args = JSON.parse(testArgs);
      } catch (e) {
        setTestResult({
          status: "error",
          error: "Invalid JSON arguments",
        });
        setIsTesting(false);
        return;
      }

      const result = await testTool({
        tool_type: formData.tool_type,
        code: formData.code,
        api_endpoint: formData.api_endpoint,
        api_request_payload: formData.api_request_payload,
        arguments: args,
      });

      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        status: "error",
        error: error.message || "Test failed",
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    const enable = formData.enabled;
    let testPassed = false;
    if (enable) {
      if (!testResult || testResult.status !== "success") {
        setError("Tool must pass test before enabling.");
        setIsSubmitting(false);
        return;
      }
      testPassed = true;
    }

    try {
      await createTool({
        ...formData,
        enabled: enable,
        test_passed: testPassed,
      });
      setFormData({
        name: "",
        symbol: "",
        description: "",
        tool_type: "function",
        code: "",
        api_endpoint: "",
        api_request_payload: "",
        api_request_example: "",
        api_response_payload: "",
        api_response_example: "",
        enabled: false,
        test_passed: false,
        scope: "assignable",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Failed to create tool:", error);
      const errorMessage = error?.message || "Failed to create tool";

      // Check if it's a duplicate symbol error
      if (
        errorMessage.includes("symbol") &&
        errorMessage.includes("already exists")
      ) {
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

      <form className="space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
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
                Request Schema (JSON)
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
                Response Schema (JSON)
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

            <div className="space-y-2">
              <Label htmlFor="api-request-example" className="text-sm">
                Request Example (JSON)
              </Label>
              <Textarea
                id="api-request-example"
                value={formData.api_request_example}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    api_request_example: e.target.value,
                  })
                }
                placeholder='{"param1": "example_value"}'
                className="min-h-[80px] resize-none font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-response-example" className="text-sm">
                Response Example (JSON)
              </Label>
              <Textarea
                id="api-response-example"
                value={formData.api_response_example}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    api_response_example: e.target.value,
                  })
                }
                placeholder='{"result": "example_value"}'
                className="min-h-[80px] resize-none font-mono text-sm"
              />
            </div>
          </>
        )}

        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Test Tool</Label>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="test-args"
              className="text-xs text-muted-foreground"
            >
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
                {testResult.status === "success" ? (
                  <pre>{testResult.result}</pre>
                ) : (
                  <pre>{testResult.error}</pre>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="panel-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <Label htmlFor="panel-enabled" className="text-sm">
                Enable Tool
              </Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit()}
              className="flex-1 h-9 primary-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? "Creating..." : "Save Tool"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
