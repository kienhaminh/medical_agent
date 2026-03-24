// web/components/doctor/intake-viewer-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSessionMessages, type VisitDetail } from "@/lib/api";

interface IntakeViewerDialogProps {
  visit: VisitDetail | null;
  open: boolean;
  onClose: () => void;
}

interface SessionMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export function IntakeViewerDialog({
  visit,
  open,
  onClose,
}: IntakeViewerDialogProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && visit?.intake_session_id) {
      setLoading(true);
      getSessionMessages(visit.intake_session_id)
        .then(setMessages)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, visit?.intake_session_id]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>
            Intake Conversation — {visit?.visit_id}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading conversation...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages found.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      msg.role === "user"
                        ? "bg-cyan-500/15"
                        : "bg-muted/50"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Intake notes */}
        {visit?.intake_notes && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-xs uppercase text-muted-foreground mb-1">
              Intake Notes
            </p>
            <p className="text-sm whitespace-pre-wrap">{visit.intake_notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
