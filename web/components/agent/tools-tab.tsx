"use client";

import { Tool } from "@/lib/api";
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
  Trash2,
  Activity,
  Search,
  Filter,
  X,
  Code,
  Globe,
} from "lucide-react";
import { ToolFormDialog } from "./tools/tool-form-dialog";
import { ToolsTabToolCard } from "./tools/tools-tab-tool-card";
import { useToolsTab } from "./tools/use-tools-tab";

export function ToolsTab() {
  const {
    tools,
    filteredTools,
    loading,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    showFilters,
    setShowFilters,
    isCreating,
    setIsCreating,
    editingTool,
    setEditingTool,
    deletingTool,
    setDeletingTool,
    handleToggleTool,
    handleDelete,
    activeFilterCount,
    setTools,
  } = useToolsTab();

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
            <ToolsTabToolCard
              key={tool.name}
              tool={tool}
              onToggle={handleToggleTool}
              onEdit={setEditingTool}
              onDelete={setDeletingTool}
            />
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
