"use client";

import { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShiftHandoffModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
  patientCount: number;
  loading: boolean;
}

export function ShiftHandoffModal({
  open,
  onClose,
  content,
  patientCount,
  loading,
}: ShiftHandoffModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Shift Handoff
              {patientCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {patientCount} patient{patientCount !== 1 ? "s" : ""}
                </span>
              )}
            </DialogTitle>
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-2">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans bg-muted/30 rounded-md p-4">
                {content || "No active patients to hand off."}
              </pre>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
