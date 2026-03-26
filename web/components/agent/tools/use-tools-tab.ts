"use client";

import { useEffect, useState } from "react";
import { getTools, updateTool, deleteTool, Tool } from "@/lib/api";
import { toast } from "sonner";

export function useToolsTab() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

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

  return {
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
  };
}
