"use client";

import { useEffect, useState } from "react";
import { getTools, createTool, updateTool, deleteTool, Tool } from "@/lib/api";
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
  Settings,
  Power,
  Wrench,
  Plus,
  Edit,
  Trash2,
  Activity,
  Search,
  Filter,
  X,
  Sparkles,
} from "lucide-react";

const toolCategories = [
  { value: "medical", label: "Medical" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "research", label: "Research" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

export default function ToolStorePage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [deletingTool, setDeletingTool] = useState<Tool | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "medical",
  });

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
          t.category?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.enabled === (statusFilter === "enabled"));
    }

    setFilteredTools(result);
  }, [searchQuery, categoryFilter, statusFilter, tools]);

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

  async function handleToggle(id: number, currentStatus: boolean) {
    try {
      const updatedTool = await updateTool(id, { enabled: !currentStatus });
      setTools((prev) => prev.map((t) => (t.id === id ? updatedTool : t)));
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const newTool = await createTool({
        ...formData,
        symbol: formData.name.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        tool_type: "function",
      });
      setTools((prev) => [...prev, newTool]);
      setIsCreating(false);
      setFormData({ name: "", description: "", category: "medical" });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTool) return;
    if (!editingTool.id) {
      console.error("Tool ID is missing. Please refresh the page.");
      return;
    }

    try {
      const updatedTool = await updateTool(editingTool.id, formData);
      setTools((prev) =>
        prev.map((t) => (t.id === editingTool.id ? updatedTool : t))
      );
      setEditingTool(null);
      setFormData({ name: "", description: "", category: "medical" });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete() {
    if (!deletingTool) return;
    if (!deletingTool.id) {
      console.error("Tool ID is missing. Please refresh the page.");
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
    setFormData({
      name: tool.name,
      description: tool.description || "",
      category: tool.category || "medical",
    });
  }

  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold flex items-center gap-3">
                <div className="w-1 h-10 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full" />
                AI Tool Registry
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage AI Agent capabilities and tools
              </p>
            </div>
            <Button
              onClick={() => setIsCreating(true)}
              className="primary-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tool
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="medical-input pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`secondary-button gap-2 ${
                  showFilters ? "bg-cyan-500/10 text-cyan-500" : ""
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-cyan-500 text-white text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <Card className="p-4 bg-card/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm">
                    Filter Options
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Category
                    </Label>
                    <Select
                      value={categoryFilter}
                      onValueChange={setCategoryFilter}
                    >
                      <SelectTrigger className="medical-input h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {toolCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="medical-input h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTools.length} of {tools.length} tools
          </p>
        </div>

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
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="inline-flex p-6 rounded-full bg-muted/50">
                <Wrench className="w-12 h-12 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold mb-2">
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
                className={`record-card group p-5 ${
                  tool.enabled
                    ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"
                    : "opacity-75"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-lg ${
                        tool.enabled
                          ? "bg-cyan-500/10 group-hover:bg-cyan-500/20"
                          : "bg-muted"
                      } transition-colors`}
                    >
                      <Wrench
                        className={`w-5 h-5 ${
                          tool.enabled
                            ? "text-cyan-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold">
                        {tool.name}
                      </h3>
                      {tool.category && (
                        <Badge
                          variant="secondary"
                          className="mt-1 text-xs medical-badge-text"
                        >
                          {tool.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {tool.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {tool.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleToggle(tool.id, tool.enabled || false)
                      }
                      className={`p-2 rounded-lg transition-all ${
                        tool.enabled
                          ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title={tool.enabled ? "Disable Tool" : "Enable Tool"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <Badge
                      variant="secondary"
                      className={
                        tool.enabled
                          ? "bg-green-500/10 text-green-500 border-green-500/30"
                          : "bg-muted"
                      }
                    >
                      {tool.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(tool)}
                      className="hover:bg-cyan-500/10 hover:text-cyan-500"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingTool(tool)}
                      className="hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Tool Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-500" />
              Add New Tool
            </DialogTitle>
            <DialogDescription>
              Create a new AI tool to extend agent capabilities
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tool Name *</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Medical Image Analyzer"
                className="medical-input"
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
                className="medical-input min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="category" className="medical-input">
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

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setFormData({
                    name: "",
                    description: "",
                    category: "medical",
                  });
                }}
                className="secondary-button"
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
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Edit className="w-6 h-6 text-cyan-500" />
              Edit Tool
            </DialogTitle>
            <DialogDescription>
              Update tool information and settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tool Name *</Label>
              <Input
                id="edit-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="medical-input"
              />
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
                className="medical-input min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger id="edit-category" className="medical-input">
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

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingTool(null);
                  setFormData({
                    name: "",
                    description: "",
                    category: "medical",
                  });
                }}
                className="secondary-button"
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
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Delete Tool
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTool?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingTool(null)}
              className="secondary-button"
            >
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
