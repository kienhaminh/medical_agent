"use client";

import { useEffect, useState } from "react";
import { getTools, updateTool, deleteTool, Tool } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Code,
  Globe,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ToolFormDialog } from "./tools/tool-form-dialog";

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

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    let result = [...tools];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.symbol?.toLowerCase().includes(query)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.tool_type === typeFilter);
    }

    setFilteredTools(result);
  }, [searchQuery, typeFilter, tools]);

  async function loadTools() {
    try {
      const data = await getTools();
      const toolsWithoutIds = data.filter((t) => !t.id);
      if (toolsWithoutIds.length > 0) {
        toast.error(
          "Some tools are missing IDs. Please run the database migration and refresh."
        );
      }
      setTools(data);
      setFilteredTools(data);
    } catch {
      toast.error("Failed to load tools");
    } finally {
      setLoading(false);
    }
  }

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
      setTools((prev) =>
        prev.map((t) => (t.id === tool.id ? { ...t, enabled } : t))
      );
      await updateTool(tool.id, { ...tool, enabled });
      toast.success(`Tool ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update tool status");
      setTools((prev) =>
        prev.map((t) => (t.name === tool.name ? { ...t, enabled: !enabled } : t))
      );
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
    } catch {
      toast.error("Failed to delete tool");
    }
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
        <Button onClick={() => setIsCreating(true)}>
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
                onClick={() => setTypeFilter("all")}
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
              <Button onClick={() => setIsCreating(true)} className="mt-4">
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
                    <div className="flex flex-col gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {tool.symbol}
                      </Badge>
                      <div className="flex items-center gap-2">
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
                    onClick={() => setEditingTool(tool)}
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

      {/* Create / Edit Tool Dialogs */}
      <ToolFormDialog
        mode="create"
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onSaved={(tool) => setTools((prev) => [...prev, tool])}
      />

      <ToolFormDialog
        mode="edit"
        open={!!editingTool}
        tool={editingTool}
        onClose={() => setEditingTool(null)}
        onSaved={(updated) =>
          setTools((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t))
          )
        }
      />

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
