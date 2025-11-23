"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  History,
  MessageSquare,
  Calendar,
  Clock,
  Search,
  Trash2,
  ExternalLink,
  Brain,
  Activity,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { getChatSessions, deleteChatSession, type ChatSession } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChatHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "today" | "week" | "month">("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await getChatSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
      toast.error("Failed to load chat history");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch =
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (session.preview && session.preview.toLowerCase().includes(searchQuery.toLowerCase())) ||
      session.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const now = new Date();
    const sessionDate = new Date(session.updated_at);
    const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (filterBy) {
      case "today":
        return daysDiff === 0;
      case "week":
        return daysDiff <= 7;
      case "month":
        return daysDiff <= 30;
      default:
        return true;
    }
  });

  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);

  const handleSessionClick = (sessionId: number) => {
    // Navigate to chat page with session loaded
    router.push(`/agent?session=${sessionId}`);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      // Optimistically remove the session from the UI immediately
      setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionToDelete));
      setSessionToDelete(null);
      
      // Then make the API call
      await deleteChatSession(sessionToDelete);
      toast.success("Conversation deleted successfully");
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error("Failed to delete conversation");
      // Reload sessions to restore the deleted session if the API call failed
      loadSessions();
    }
  };

  const handleDeleteClick = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20" />
        <div className="scan-line absolute inset-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center medical-border-glow">
                  <History className="w-5 h-5 text-cyan-500" />
                </div>
              </div>
              <div>
                <h1 className="font-display text-xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                  Chat History
                </h1>
                <p className="text-xs text-muted-foreground">
                  Browse and manage your previous conversations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="medical-badge-text">
                {filteredSessions.length} sessions
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/agent")}
                className="secondary-button gap-2"
              >
                <MessageSquare className="w-3 h-3" />
                New Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="relative z-10 border-b border-border/50 bg-card/20 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 medical-input"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {(["all", "today", "week", "month"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={filterBy === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterBy(filter)}
                  className={cn(
                    filterBy === filter ? "primary-button" : "secondary-button",
                    "capitalize"
                  )}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1 relative z-10 min-h-0">
        <div className="container mx-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading chat history...</p>
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center mx-auto medical-border-glow">
                  <History className="w-8 h-8 text-cyan-500" />
                </div>
                <h3 className="font-display text-lg font-bold">No conversations found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterBy !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Start a new conversation to see it appear here"}
                </p>
                <Button
                  onClick={() => router.push("/agent")}
                  className="primary-button gap-2 mt-4"
                >
                  <MessageSquare className="w-4 h-4" />
                  Start New Chat
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 max-w-5xl mx-auto">
              {filteredSessions.map((session, index) => (
                <Card
                  key={session.id}
                  className="group cursor-pointer hover:scale-[1.01] transition-all duration-200 medical-border-glow-hover animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => handleSessionClick(session.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <MessageSquare className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                          <span className="truncate">{session.title}</span>
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-2">
                          {session.preview}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteClick(session.id, e)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Tags */}
                    {session.tags && session.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {session.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs medical-badge-text"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {session.agent_name && (
                          <div className="flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            <span>{session.agent_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          <span>{session.message_count} messages</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(session.created_at), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat session and all associated messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
