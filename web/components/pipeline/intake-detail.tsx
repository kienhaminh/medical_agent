"use client";

import { useEffect, useState, useRef } from "react";
import { VisitDetail } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface IntakeDetailProps {
  visit: VisitDetail;
}

interface ChatMsg {
  id: number;
  role: string;
  content: string;
}

export function IntakeDetail({ visit }: IntakeDetailProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visit.intake_session_id) {
      setLoading(false);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `/api/chat/sessions/${visit.intake_session_id}/messages`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [visit.intake_session_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Intake in Progress
          </Badge>
        </div>
        <p className="text-sm text-foreground">{visit.patient_name}</p>
        <p className="text-xs text-muted-foreground">
          {visit.patient_dob} · {visit.patient_gender}
        </p>
        {visit.chief_complaint && (
          <p className="text-sm text-muted-foreground mt-2">
            Chief complaint: {visit.chief_complaint}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <p className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
          Intake Chat (read-only)
        </p>
        <ScrollArea className="h-full rounded-lg border border-border/40 bg-background/40 p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Waiting for intake conversation...
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm ${
                    msg.role === "user"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-mono text-muted-foreground/60 mr-2">
                    {msg.role === "user" ? "Patient:" : "Agent:"}
                  </span>
                  {msg.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
