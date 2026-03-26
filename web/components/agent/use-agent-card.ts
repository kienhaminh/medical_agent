"use client";

import { useState, useEffect } from "react";
import { toggleAgent, deleteAgent, cloneAgent, getAgentTools } from "@/lib/api";
import { toast } from "sonner";
import type { SubAgent } from "@/types/agent";
import type { AgentCardProps } from "@/types/agent-ui";

export function useAgentCard({ agent, onUpdate, onDelete }: AgentCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showToolsDialog, setShowToolsDialog] = useState(false);
  const [toolCount, setToolCount] = useState<number>(0);
  const [isLoadingTools, setIsLoadingTools] = useState(true);

  useEffect(() => {
    const fetchToolCount = async () => {
      try {
        setIsLoadingTools(true);
        const tools = await getAgentTools(agent.id);
        setToolCount(tools.length);
      } catch {
        setToolCount(0);
      } finally {
        setIsLoadingTools(false);
      }
    };
    fetchToolCount();
  }, [agent.id]);

  const handleToggle = async (enabled: boolean) => {
    try {
      setIsToggling(true);
      await toggleAgent(agent.id, enabled);
      toast.success(`Agent ${enabled ? "enabled" : "disabled"}`);
      onUpdate({ ...agent, enabled } as SubAgent);
    } catch {
      toast.error("Failed to toggle agent");
    } finally {
      setIsToggling(false);
    }
  };

  const handleClone = async () => {
    try {
      await cloneAgent(agent.id);
      toast.success("Agent cloned successfully");
      onUpdate();
    } catch {
      toast.error("Failed to clone agent");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agent.id);
      toast.success("Agent deleted");
      onDelete();
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  const refreshToolCount = async () => {
    try {
      const tools = await getAgentTools(agent.id);
      setToolCount(tools.length);
    } catch {
      // tool count display is non-critical; silently keep previous count
    }
  };

  return {
    isToggling,
    showEditDialog, setShowEditDialog,
    showDeleteDialog, setShowDeleteDialog,
    showToolsDialog, setShowToolsDialog,
    toolCount,
    isLoadingTools,
    handleToggle,
    handleClone,
    handleDelete,
    refreshToolCount,
  };
}
