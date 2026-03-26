"use client";

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
import { Settings, Wrench, Plus, Trash2, Activity, Search, Filter, X } from "lucide-react";
import { ToolMetadataDialog } from "./tool-metadata-dialog";
import { ToolCard } from "./tool-card";
import { useToolStorePage } from "./use-tool-store-page";

const TOOL_CATEGORIES = [
  { value: "medical", label: "Medical" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "research", label: "Research" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

export default function ToolStorePage() {
  const {
    tools,
    setTools,
    filteredTools,
    loading,
    searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    showFilters, setShowFilters,
    isCreating, setIsCreating,
    editingTool, setEditingTool,
    deletingTool, setDeletingTool,
    activeFilterCount,
    handleToggle,
    handleDelete,
  } = useToolStorePage();

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
            <Button onClick={() => setIsCreating(true)}>
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
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={`gap-2 ${showFilters ? "bg-cyan-500/10 text-cyan-500" : ""}`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-cyan-500 text-white text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <Card className="p-4 bg-card/50 border-border/50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm">Filter Options</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {TOOL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
        <p className="text-sm text-muted-foreground mb-6">
          Showing {filteredTools.length} of {tools.length} tools
        </p>

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
                  {searchQuery || activeFilterCount > 0 ? "No tools found" : "No tools yet"}
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
              <ToolCard
                key={tool.name}
                tool={tool}
                onToggle={handleToggle}
                onEdit={setEditingTool}
                onDelete={setDeletingTool}
              />
            ))}
          </div>
        )}
      </div>

      <ToolMetadataDialog
        mode="create"
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onSaved={(tool) => { setTools((prev) => [...prev, tool]); }}
      />

      <ToolMetadataDialog
        mode="edit"
        open={!!editingTool}
        tool={editingTool}
        onClose={() => setEditingTool(null)}
        onSaved={(updated) =>
          setTools((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        }
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deletingTool} onOpenChange={() => setDeletingTool(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Delete Tool
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingTool?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeletingTool(null)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
