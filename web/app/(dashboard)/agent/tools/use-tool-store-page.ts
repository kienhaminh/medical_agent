"use client";

import { useEffect, useState } from "react";
import { getTools, updateTool, deleteTool, type Tool } from "@/lib/api";
import { toast } from "sonner";

export function useToolStorePage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") result = result.filter((t) => t.category === categoryFilter);
    if (statusFilter !== "all") result = result.filter((t) => t.enabled === (statusFilter === "enabled"));
    setFilteredTools(result);
  }, [searchQuery, categoryFilter, statusFilter, tools]);

  async function loadTools() {
    try {
      const data = await getTools();
      setTools(data);
      setFilteredTools(data);
    } catch {
      toast.error("Failed to load tools");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: number, currentEnabled: boolean) {
    try {
      const updated = await updateTool(id, { enabled: !currentEnabled });
      setTools((prev) => prev.map((t) => (t.id === id ? updated : t)));
      toast.success(`Tool ${!currentEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update tool status");
    }
  }

  async function handleDelete() {
    if (!deletingTool?.id) {
      toast.error("Tool ID is missing. Please refresh the page.");
      return;
    }
    try {
      await deleteTool(deletingTool.id);
      setTools((prev) => prev.filter((t) => t.id !== deletingTool.id));
      setDeletingTool(null);
      toast.success("Tool deleted");
    } catch {
      toast.error("Failed to delete tool");
    }
  }

  const activeFilterCount = (categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  return {
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
  };
}
