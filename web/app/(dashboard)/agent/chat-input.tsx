"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onKeyDown,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = input.trim() && !isLoading;

  return (
    <div className="relative z-10 border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4 max-w-3xl">
        <form onSubmit={onSubmit}>
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 focus-within:border-border transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a question or describe a case…"
              className="flex-1 min-h-[24px] max-h-[160px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              disabled={isLoading}
              rows={1}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150",
                canSubmit
                  ? "bg-foreground text-background hover:opacity-80"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
            AI can make mistakes — always verify medical information
          </p>
        </form>
      </div>
    </div>
  );
}
