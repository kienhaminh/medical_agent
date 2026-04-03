"use client";

import { Brain, Activity, Zap, Sparkles } from "lucide-react";

const SUGGESTED_PROMPTS = [
  { icon: Brain, text: "Analyze patient symptoms and suggest diagnostic pathways" },
  { icon: Activity, text: "Explain the latest treatment protocols for hypertension" },
  { icon: Zap, text: "Summarize recent advances in medical imaging technology" },
  { icon: Sparkles, text: "Generate a differential diagnosis for chest pain" },
];

interface ChatWelcomeProps {
  onSelectPrompt: (text: string) => void;
}

export function ChatWelcome({ onSelectPrompt }: ChatWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] px-4 animate-in fade-in duration-500">
      <div className="w-full max-w-xl space-y-8">
        {/* Heading */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            How can I help today?
          </h2>
          <p className="text-sm text-muted-foreground">
            Ask questions, analyze cases, or discuss treatment protocols.
          </p>
        </div>

        {/* Suggested prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              onClick={() => onSelectPrompt(text)}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left text-sm hover:border-border hover:bg-muted/50 transition-all duration-150"
            >
              <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-foreground transition-colors" />
              <span className="text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                {text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
