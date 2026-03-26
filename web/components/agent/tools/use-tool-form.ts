"use client";

import { useState, useEffect } from "react";
import { createTool, updateTool, testTool, type Tool } from "@/lib/api";
import { toast } from "sonner";

export type FormData = {
  name: string;
  symbol: string;
  description: string;
  tool_type: "function" | "api";
  code: string;
  api_endpoint: string;
  api_request_payload: string;
  api_request_example: string;
  api_response_payload: string;
  api_response_example: string;
  enabled: boolean;
  test_passed: boolean;
  scope: "global" | "assignable" | "both";
};

export const EMPTY_FORM: FormData = {
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
};

export type TestResult = { status: string; result?: string; error?: string };

interface UseToolFormOptions {
  mode: "create" | "edit";
  open: boolean;
  tool?: Tool | null;
  onClose: () => void;
  onSaved: (tool: Tool) => void;
}

export function useToolForm({ mode, open, tool, onClose, onSaved }: UseToolFormOptions) {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && tool) {
      setFormData({
        name: tool.name,
        symbol: tool.symbol || "",
        description: tool.description || "",
        tool_type: (tool.tool_type as "function" | "api") || "function",
        code: tool.code || "",
        api_endpoint: tool.api_endpoint || "",
        api_request_payload: tool.api_request_payload || "",
        api_request_example: tool.api_request_example || "",
        api_response_payload: tool.api_response_payload || "",
        api_response_example: tool.api_response_example || "",
        enabled: tool.enabled || false,
        test_passed: tool.test_passed || false,
        scope: (tool.scope as "global" | "assignable" | "both") || "assignable",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setFormError(null);
    setTestResult(null);
    setTestArgs("{}");
  }, [open, mode, tool]);

  function handleNameChange(name: string) {
    const symbol = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setFormData({ ...formData, name, symbol });
  }

  function formatJSON(value: string): string {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      toast.error("Invalid JSON format");
      return value;
    }
  }

  function formatJsonForDisplay(value?: string | null): string {
    if (!value?.trim()) return "";
    try {
      return JSON.stringify(JSON.parse(value.trim()), null, 2);
    } catch {
      return value;
    }
  }

  function handleFormatJSON(
    field:
      | "api_request_payload"
      | "api_response_payload"
      | "api_request_example"
      | "api_response_example"
      | "test_args"
  ) {
    const current = field === "test_args" ? testArgs : formData[field];
    if (!current?.trim()) { toast.error("Field is empty"); return; }
    const formatted = formatJSON(current);
    if (field === "test_args") {
      setTestArgs(formatted);
    } else {
      setFormData({ ...formData, [field]: formatted });
    }
    toast.success("JSON formatted successfully");
  }

  async function handleTest() {
    setIsTesting(true);
    setTestResult(null);
    try {
      let args = {};
      try {
        args = JSON.parse(testArgs);
      } catch {
        setTestResult({ status: "error", error: "Invalid JSON arguments" });
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
    } catch (err) {
      setTestResult({ status: "error", error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    setFormError(null);
    setIsSaving(true);
    try {
      let saved: Tool;
      if (mode === "create") {
        saved = await createTool(formData);
        toast.success("Tool created successfully");
      } else {
        if (!tool?.id) { setFormError("Tool ID is missing. Please refresh the page."); return; }

        let test_passed = formData.test_passed;
        if (formData.enabled) {
          if (testResult?.status === "success") {
            test_passed = true;
          } else if (!tool.test_passed) {
            setFormError("Tool must pass test before enabling.");
            return;
          } else {
            const codeChanged = formData.code !== tool.code || formData.api_endpoint !== tool.api_endpoint;
            if (codeChanged && testResult?.status !== "success") {
              setFormError("Tool code changed. Must pass test before enabling.");
              return;
            }
          }
        }

        saved = await updateTool(tool.id, { ...formData, test_passed });
        toast.success("Tool saved");
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${mode === "create" ? "create" : "update"} tool`;
      if (mode === "create" && msg.includes("symbol") && msg.includes("already exists")) {
        setFormError("Choose another symbol name for tool");
      } else {
        setFormError(msg);
        if (mode === "edit") toast.error(msg);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return {
    formData,
    setFormData,
    formError,
    testArgs,
    setTestArgs,
    testResult,
    isTesting,
    isSaving,
    handleNameChange,
    handleFormatJSON,
    handleTest,
    handleSave,
    formatJsonForDisplay,
  };
}
