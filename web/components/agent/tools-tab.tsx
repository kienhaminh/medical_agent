"use client";

import { useEffect, useState } from "react";
import {
  getTools,
  createTool,
  updateTool,
  deleteTool,
  Tool,
} from "@/lib/api";
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
} from "lucide-react";

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
    api_response_payload: "",
    scope: "assignable",
  });
  const [formError, setFormError] = useState<string | null>(null);

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
      setTools(data);
      setFilteredTools(data);
    } catch (error) {
      console.error(error);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const newTool = await createTool(formData);
      setTools((prev) => [...prev, newTool]);
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
        api_response_payload: "",
        scope: "assignable",
      });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "Failed to create tool";

      // Check if it's a duplicate symbol error
      if (errorMessage.includes("symbol") && errorMessage.includes("already exists")) {
        setFormError("Choose another symbol name for tool");
      } else {
        setFormError(errorMessage);
      }
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTool) return;

    try {
      const updatedTool = await updateTool(editingTool.name, formData);
      setTools((prev) =>
        prev.map((t) => (t.name === editingTool.name ? updatedTool : t))
      );
      setEditingTool(null);
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
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete() {
    if (!deletingTool) return;

    try {
      await deleteTool(deletingTool.name);
      setTools((prev) => prev.filter((t) => t.name !== deletingTool.name));
      setDeletingTool(null);
    } catch (error) {
      console.error(error);
    }
  }

  function openEditModal(tool: Tool) {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      symbol: tool.symbol,
      description: tool.description || "",
      tool_type: tool.tool_type,
      code: tool.code || "",
      api_endpoint: tool.api_endpoint || "",
      api_request_payload: tool.api_request_payload || "",
      api_response_payload: tool.api_response_payload || "",
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
              className="group p-5 transition-all hover:shadow-md border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                    {tool.tool_type === "function" ? (
                      <Code className="w-5 h-5 text-cyan-500" />
                    ) : (
                      <Globe className="w-5 h-5 text-cyan-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
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
                    </div>
                  </div>
                </div>
              </div>

              {tool.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {tool.description}
                </p>
              )}

              <div className="flex items-center justify-end mt-auto pt-4 border-t border-border/50">
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              Add New Tool
            </DialogTitle>
            <DialogDescription>
              Create a new AI tool to extend agent capabilities
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
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
                  <Label htmlFor="api-request">Request Payload (JSON)</Label>
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
                  <Label htmlFor="api-response">Response Payload (JSON)</Label>
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
              </>
            )}

            <div className="flex gap-3 justify-end pt-4">
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
                    api_response_payload: "",
                    scope: "assignable",
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="primary-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Tool
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tool Dialog */}
      <Dialog open={!!editingTool} onOpenChange={() => setEditingTool(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-500" />
              Edit Tool
            </DialogTitle>
            <DialogDescription>
              Update tool information and settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
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
                  <Label htmlFor="edit-api-request">
                    Request Payload (JSON)
                  </Label>
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
                  <Label htmlFor="edit-api-response">
                    Response Payload (JSON)
                  </Label>
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
              </>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingTool(null);
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
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="primary-button">
                <Edit className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
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
              Are you sure you want to delete "{deletingTool?.name}"? This
              action cannot be undone.
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
