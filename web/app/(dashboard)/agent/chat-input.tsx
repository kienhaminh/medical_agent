"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Send } from "lucide-react";

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

  return (
    <div className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-xl">
      <div className="container mx-auto px-6 py-5 max-w-4xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a medical question or describe a case... (Enter to send, Shift+Enter for new line)"
              className="min-h-[80px] max-h-[200px] resize-none pr-16 text-sm"
              disabled={isLoading}
            />
            <div className="absolute right-3 bottom-3">
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>AI Ready</span>
            </div>
            <Separator orientation="vertical" className="h-3" />
            <span>Powered by Advanced LLM</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-yellow-500">⚠ Verify medical information</span>
          </div>
        </form>
      </div>
    </div>
  );
}
