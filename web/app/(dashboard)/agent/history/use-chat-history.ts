"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getChatSessions, deleteChatSession, type ChatSession } from "@/lib/api";
import { toast } from "sonner";

export function useChatHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "today" | "week" | "month">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await getChatSessions();
      setSessions(data);
    } catch {
      toast.error("Failed to load chat history");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.preview &&
        session.preview.toLowerCase().includes(searchQuery.toLowerCase())) ||
      session.tags?.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    if (!matchesSearch) return false;

    const now = new Date();
    const sessionDate = new Date(session.updated_at);
    const daysDiff = Math.floor(
      (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (filterBy) {
      case "today": return daysDiff === 0;
      case "week": return daysDiff <= 7;
      case "month": return daysDiff <= 30;
      default: return true;
    }
  });

  const handleSessionClick = (sessionId: number) => {
    router.push(`/agent?session=${sessionId}`);
  };

  const handleDeleteClick = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
      setSessionToDelete(null);
      await deleteChatSession(sessionToDelete);
      toast.success("Conversation deleted successfully");
    } catch {
      toast.error("Failed to delete conversation");
      loadSessions();
    }
  };

  return {
    sessions,
    filteredSessions,
    searchQuery,
    setSearchQuery,
    filterBy,
    setFilterBy,
    isLoading,
    sessionToDelete,
    setSessionToDelete,
    handleSessionClick,
    handleDeleteClick,
    confirmDelete,
  };
}
