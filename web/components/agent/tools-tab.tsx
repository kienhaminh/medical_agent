"use client";

import { useEffect, useState } from "react";
import {
  getTools,
  createTool,
  updateTool,
  deleteTool,
  testTool,
  Tool,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Wrench,
  Plus,
  Edit,
  Trash2,
  Activity,
  Search,
  Filter,
  X,
  Sparkles,
  Code,
  Globe,
  Play,
  AlignLeft,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ToolsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [deletingTool, setDeletingTool] = useState<Tool | null>(null);

  // Form state
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
  const [formError, setFormError] = useState<string | null>(null);

  // Test state
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<{
    status: string;
    result?: string;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Format JSON utility function
  function formatJSON(jsonString: string): string {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      toast.error("Invalid JSON format");
      return jsonString;
    }
  }

  // Format JSON for displaying API responses without toasts
  function formatJsonForDisplay(value?: string | null): string {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return value;
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }

  // Format JSON handlers for different fields
  function handleFormatJSON(field: string) {
    let currentValue = "";
    let updateFn: (value: string) => void;

    switch (field) {
      case "api_request_payload":
        currentValue = formData.api_request_payload;
        updateFn = (value) =>
          setFormData({ ...formData, api_request_payload: value });
        break;
      case "api_response_payload":
        currentValue = formData.api_response_payload;
        updateFn = (value) =>
          setFormData({ ...formData, api_response_payload: value });
        break;
      case "api_request_example":
        currentValue = formData.api_request_example;
        updateFn = (value) =>
          setFormData({ ...formData, api_request_example: value });
        break;
      case "api_response_example":
        currentValue = formData.api_response_example;
        updateFn = (value) =>
          setFormData({ ...formData, api_response_example: value });
        break;
      case "test_args":
        currentValue = testArgs;
        updateFn = (value) => setTestArgs(value);
        break;
      default:
        return;
    }

    if (!currentValue.trim()) {
      toast.error("Field is empty");
      return;
    }

    const formatted = formatJSON(currentValue);
    updateFn(formatted);
    toast.success("JSON formatted successfully");
  }

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

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    let result = [...tools];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.symbol?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((t) => t.tool_type === typeFilter);
    }

    setFilteredTools(result);
  }, [searchQuery, typeFilter, tools]);

  async function loadTools() {
    try {
      const data = await getTools();
      // Check if tools have IDs (required after migration)
      const toolsWithoutIds = data.filter((t) => !t.id);
      if (toolsWithoutIds.length > 0) {
        console.warn(
          `Warning: ${toolsWithoutIds.length} tool(s) are missing IDs. Please run the database migration: alembic upgrade head`
        );
        toast.error(
          "Some tools are missing IDs. Please run the database migration and refresh."
        );
      }
      setTools(data);
      setFilteredTools(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load tools");
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate symbol from name
  const handleNameChange = (name: string) => {
    const symbol = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setFormData({ ...formData, name, symbol });
  };

  async function handleToggleTool(tool: Tool, enabled: boolean) {
    if (enabled && !tool.test_passed) {
      toast.error("Tool must pass test before enabling");
      return;
    }

    if (!tool.id) {
      toast.error("Tool ID is missing. Please refresh the page.");
      return;
    }

    try {
      // Optimistic update
      setTools((prev) =>
        prev.map((t) => (t.id === tool.id ? { ...t, enabled } : t))
      );

      await updateTool(tool.id, { ...tool, enabled });
      toast.success(`Tool ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update tool status");
      // Revert optimistic update
      setTools((prev) =>
        prev.map((t) =>
          t.name === tool.name ? { ...t, enabled: !enabled } : t
        )
      );
    }
  }

  async function handleCreate() {
    setFormError(null);

    const enable = formData.enabled;
    let testPassed = false;
    if (enable) {
      if (!testResult || testResult.status !== "success") {
        setFormError("Tool must pass test before enabling.");
        return;
      }
      testPassed = true;
    }

    try {
      const newTool = await createTool({
        ...formData,
        enabled: enable,
        test_passed: testPassed,
      });
      setTools((prev) => [...prev, newTool]);
      setIsCreating(false);
      setFormError(null);
      setTestResult(null);
      setTestArgs("{}");
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
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "Failed to create tool";

      // Check if it's a duplicate symbol error
      if (
        errorMessage.includes("symbol") &&
        errorMessage.includes("already exists")
      ) {
        setFormError("Choose another symbol name for tool");
      } else {
        setFormError(errorMessage);
      }
    }
  }

  async function handleUpdate() {
    console.log("handleUpdate", editingTool);
    if (!editingTool) return;
    if (!editingTool.id) {
      setFormError(
        "Tool ID is missing. Please refresh the page and try again."
      );
      return;
    }
    setFormError(null);

    const enable = formData.enabled;
    let testPassed = formData.test_passed; // Keep existing status by default

    // If enabling, require test pass
    if (enable) {
      // Check if we have a fresh successful test
      if (testResult && testResult.status === "success") {
        testPassed = true;
      } else if (!editingTool.test_passed) {
        // If it wasn't passed before and we haven't tested it now, error
        setFormError("Tool must pass test before enabling.");
        return;
      } else {
        // It was passed before, and we are enabling (or keeping enabled).
        // If code changed, backend will reset test_passed to false and error if enabled=True.
        // But we can also check here if we want to be strict.
        // For now, let's rely on the fact that if they didn't run a test, we send the old test_passed value (or whatever is in formData).
        // Actually, formData.test_passed comes from editingTool state.
        // If they changed code, we should probably force re-test.
        // Let's check if code/api changed from original.
        const codeChanged =
          formData.code !== editingTool.code ||
          formData.api_endpoint !== editingTool.api_endpoint;

        if (codeChanged && (!testResult || testResult.status !== "success")) {
          setFormError("Tool code changed. Must pass test before enabling.");
          return;
        }
        // If code changed and test passed, we set testPassed = true above.
      }
    } else {
      // If disabling, we don't strictly need to change test_passed, but backend might reset it if code changed.
      // We'll just send what we have.
    }

    // If we have a successful test result right now, always update test_passed to true
    if (testResult && testResult.status === "success") {
      testPassed = true;
    }

    try {
      setIsUpdating(true);
      const updatedTool = await updateTool(editingTool.id, {
        ...formData,
        enabled: enable,
        test_passed: testPassed,
      });
      setTools((prev) =>
        prev.map((t) => (t.id === editingTool.id ? updatedTool : t))
      );
      toast.success("Tool updated successfully");
      setEditingTool(null);
      setFormError(null);
      setTestResult(null);
      setTestArgs("{}");
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
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "Failed to update tool";
      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deletingTool) return;
    if (!deletingTool.id) {
      toast.error("Tool ID is missing. Please refresh the page.");
      return;
    }

    try {
      await deleteTool(deletingTool.id);
      setTools((prev) => prev.filter((t) => t.id !== deletingTool.id));
      setDeletingTool(null);
    } catch (error) {
      console.error(error);
    }
  }

  function openEditModal(tool: Tool) {
    setEditingTool(tool);
    setFormError(null);
    setTestResult(null);
    setTestArgs("{}");
    setFormData({
      name: tool.name,
      symbol: tool.symbol,
      description: tool.description || "",
      tool_type: tool.tool_type,
      code: tool.code || "",
      api_endpoint: tool.api_endpoint || "",
      api_request_payload: tool.api_request_payload || "",
      api_request_example: tool.api_request_example || "",
      api_response_payload: tool.api_response_payload || "",
      api_response_example: tool.api_response_example || "",
      enabled: tool.enabled || false,
      test_passed: tool.test_passed || false,
      scope: tool.scope || "assignable",
    });
  }

  const activeFilterCount = typeFilter !== "all" ? 1 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Available Tools</h2>
          <p className="text-sm text-muted-foreground">
            Manage and configure tools available to your agents
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="primary-button">
          <Plus className="w-4 h-4 mr-2" />
          Add Tool
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-2 ${
              showFilters
                ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 bg-cyan-500 text-white text-xs hover:bg-cyan-600"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 bg-muted/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Filter Options</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTypeFilter("all");
                }}
                className="text-xs h-8"
              >
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tool Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
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
          </Card>
        )}
      </div>

      {/* Tool List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="space-y-4 text-center">
            <div className="inline-flex p-4 rounded-full bg-cyan-500/10 animate-pulse">
              <Activity className="w-8 h-8 text-cyan-500" />
            </div>
            <p className="text-muted-foreground">Loading tools...</p>
          </div>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="flex items-center justify-center py-16 border rounded-lg border-dashed">
          <div className="text-center space-y-4">
            <div className="inline-flex p-6 rounded-full bg-muted">
              <Wrench className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-xl mb-2">
                {searchQuery || activeFilterCount > 0
                  ? "No tools found"
                  : "No tools yet"}
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                {searchQuery || activeFilterCount > 0
                  ? "Try adjusting your filters or search query."
                  : "Get started by adding your first AI tool."}
              </p>
            </div>
            {!searchQuery && activeFilterCount === 0 && (
              <Button
                onClick={() => setIsCreating(true)}
                className="primary-button mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Tool
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <Card
              key={tool.name}
              className="group p-4 transition-all hover:shadow-md border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                    {tool.tool_type === "function" ? (
                      <Code className="w-4 h-4 text-cyan-500" />
                    ) : (
                      <Globe className="w-4 h-4 text-cyan-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {tool.symbol}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          tool.tool_type === "function"
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-500 border-purple-500/30"
                        }`}
                      >
                        {tool.tool_type === "function" ? "Function" : "API"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          tool.enabled
                            ? "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
                            : "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
                        }`}
                      >
                        {tool.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={tool.enabled}
                    onCheckedChange={(checked) =>
                      handleToggleTool(tool, checked)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {tool.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {tool.description}
                </p>
              )}

              <div className="flex items-center justify-end mt-auto pt-3 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(tool)}
                    className="hover:bg-cyan-500/10 hover:text-cyan-500 h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingTool(tool)}
                    className="hover:bg-red-500/10 hover:text-red-500 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Tool Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              Add New Tool
            </DialogTitle>
            <DialogDescription>
              Create a new AI tool to extend agent capabilities
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
            {formError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Tool Name *</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Query Patient Tool"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol">Tool Symbol * (snake_case)</Label>
              <Input
                id="symbol"
                type="text"
                required
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value })
                }
                placeholder="e.g., query_patient_tool"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this tool does..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-type">Tool Type *</Label>
              <Select
                value={formData.tool_type}
                onValueChange={(value: "function" | "api") =>
                  setFormData({ ...formData, tool_type: value })
                }
              >
                <SelectTrigger id="tool-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="function">Function</SelectItem>
                  <SelectItem value="api">API Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tool_type === "function" && (
              <div className="space-y-2">
                <Label htmlFor="code">Function Code</Label>
                <Textarea
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="def function():\n    # Your code here\n    pass"
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>
            )}

            {formData.tool_type === "api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api-endpoint">API Endpoint</Label>
                  <Input
                    id="api-endpoint"
                    value={formData.api_endpoint}
                    onChange={(e) =>
                      setFormData({ ...formData, api_endpoint: e.target.value })
                    }
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-request">Request Schema (JSON)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_request_payload")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
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
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-response">Response Schema (JSON)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_response_payload")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
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
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-request-example">
                      Request Example (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_request_example")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
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
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-response-example">
                      Response Example (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_response_example")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
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
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>
              </>
            )}

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Test Tool</Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="test-args"
                    className="text-xs text-muted-foreground"
                  >
                    Arguments (JSON)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatJSON("test_args")}
                    className="h-7 px-2 text-xs"
                  >
                    <AlignLeft className="w-3 h-3 mr-1" />
                    Format JSON
                  </Button>
                </div>
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
                      <pre>{formatJsonForDisplay(testResult.result)}</pre>
                    ) : (
                      <pre>{formatJsonForDisplay(testResult.error)}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setFormError(null);
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
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="primary-button"
                  onClick={() => handleCreate()}
                >
                  Save Tool
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tool Dialog */}
      <Dialog
        open={!!editingTool}
        onOpenChange={() => {
          setEditingTool(null);
          setFormError(null);
          setTestResult(null);
          setTestArgs("{}");
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-500" />
              Edit Tool
            </DialogTitle>
            <DialogDescription>
              Update tool information and settings
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
            {formError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-name">Tool Name *</Label>
              <Input
                id="edit-name"
                type="text"
                required
                value={formData.name}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Tool name cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-symbol">Tool Symbol *</Label>
              <Input
                id="edit-symbol"
                type="text"
                required
                value={formData.symbol}
                disabled
                className="font-mono text-sm bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Tool symbol cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe what this tool does..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tool-type">Tool Type *</Label>
              <Select
                value={formData.tool_type}
                onValueChange={(value: "function" | "api") =>
                  setFormData({ ...formData, tool_type: value })
                }
              >
                <SelectTrigger id="edit-tool-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="function">Function</SelectItem>
                  <SelectItem value="api">API Call</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tool_type === "function" && (
              <div className="space-y-2">
                <Label htmlFor="edit-code">Function Code</Label>
                <Textarea
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="def function():\n    # Your code here\n    pass"
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>
            )}

            {formData.tool_type === "api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-api-endpoint">API Endpoint</Label>
                  <Input
                    id="edit-api-endpoint"
                    value={formData.api_endpoint}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_endpoint: e.target.value,
                      })
                    }
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-api-request">
                      Request Schema (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_request_payload")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
                  <Textarea
                    id="edit-api-request"
                    value={formData.api_request_payload}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_request_payload: e.target.value,
                      })
                    }
                    placeholder='{"param1": "value1"}'
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-api-response">
                      Response Schema (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_response_payload")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
                  <Textarea
                    id="edit-api-response"
                    value={formData.api_response_payload}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_response_payload: e.target.value,
                      })
                    }
                    placeholder='{"result": "value"}'
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-api-request-example">
                      Request Example (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_request_example")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
                  <Textarea
                    id="edit-api-request-example"
                    value={formData.api_request_example}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_request_example: e.target.value,
                      })
                    }
                    placeholder='{"param1": "example_value"}'
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-api-response-example">
                      Response Example (JSON)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFormatJSON("api_response_example")}
                      className="h-7 px-2 text-xs"
                    >
                      <AlignLeft className="w-3 h-3 mr-1" />
                      Format JSON
                    </Button>
                  </div>
                  <Textarea
                    id="edit-api-response-example"
                    value={formData.api_response_example}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        api_response_example: e.target.value,
                      })
                    }
                    placeholder='{"result": "example_value"}'
                    className="min-h-[80px] font-mono text-sm"
                  />
                </div>
              </>
            )}

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Test Tool</Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="edit-test-args"
                    className="text-xs text-muted-foreground"
                  >
                    Arguments (JSON)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatJSON("test_args")}
                    className="h-7 px-2 text-xs"
                  >
                    <AlignLeft className="w-3 h-3 mr-1" />
                    Format JSON
                  </Button>
                </div>
                <Textarea
                  id="edit-test-args"
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
                      <pre>{formatJsonForDisplay(testResult.result)}</pre>
                    ) : (
                      <pre>{formatJsonForDisplay(testResult.error)}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <div className="flex gap-3 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingTool(null);
                    setFormError(null);
                    setTestResult(null);
                    setTestArgs("{}");
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
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="primary-button"
                  onClick={() => handleUpdate()}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTool} onOpenChange={() => setDeletingTool(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Tool
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingTool?.name}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeletingTool(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
