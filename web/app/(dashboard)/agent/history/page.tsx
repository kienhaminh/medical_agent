"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import {
  History,
  MessageSquare,
  Search,
  Filter,
} from "lucide-react";
import { ChatSessionCard } from "./chat-session-card";
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
import { useChatHistory } from "./use-chat-history";

export default function ChatHistoryPage() {
  const router = useRouter();
  const {
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
  } = useChatHistory();

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 dot-matrix-bg opacity-20" />
        <div className="scan-line absolute inset-0" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/50 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center medical-border-glow">
                  <History className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-primary">
                  Chat History
                </h1>
                <p className="text-xs text-muted-foreground">
                  Browse and manage your previous conversations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="clinical">
                {filteredSessions.length} sessions
              </Badge>
              <Button
                size="sm"
                onClick={() => router.push("/agent")}
                variant="outline" className="gap-2"
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {(["all", "today", "week", "month"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={filterBy === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterBy(filter)}
                  className="capitalize"
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
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Loading chat history...</p>
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto medical-border-glow">
                  <History className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold">No conversations found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterBy !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Start a new conversation to see it appear here"}
                </p>
                <Button onClick={() => router.push("/agent")} className="gap-2 mt-4">
                  <MessageSquare className="w-4 h-4" />
                  Start New Chat
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 max-w-5xl mx-auto">
              {filteredSessions.map((session, index) => (
                <ChatSessionCard
                  key={session.id}
                  session={session}
                  index={index}
                  onClick={() => handleSessionClick(session.id)}
                  onDelete={(e) => handleDeleteClick(session.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={() => setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              chat session and all associated messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
