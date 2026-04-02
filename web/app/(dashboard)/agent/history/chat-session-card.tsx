"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Trash2,
  ExternalLink,
  Brain,
  Activity,
  Clock,
  Calendar,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { ChatSession } from "@/lib/api";

interface ChatSessionCardProps {
  session: ChatSession;
  index: number;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function ChatSessionCard({ session, index, onClick, onDelete }: ChatSessionCardProps) {
  return (
    <Card
      className="group cursor-pointer hover:scale-[1.01] transition-all duration-200 medical-border-glow-hover"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
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
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {session.tags && session.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {session.tags.map((tag) => (
              <Badge key={tag} variant="clinical" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Separator />

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
  );
}
