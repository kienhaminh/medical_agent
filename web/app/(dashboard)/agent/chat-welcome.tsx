"use client";

import { Separator } from "@/components/ui/separator";
import { Sparkles, Activity, Brain, Zap } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] space-y-8 animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 flex items-center justify-center medical-border-glow">
          <Sparkles className="w-12 h-12 text-cyan-500 animate-pulse" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full animate-pulse" />
      </div>

      <div className="text-center space-y-3 max-w-2xl">
        <h2 className="font-display text-3xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
          Ready to Assist
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Multi-modal medical AI assistant powered by advanced language models. Ask
          questions, analyze cases, or discuss treatment protocols.
        </p>
      </div>

      <Separator className="w-24" />

      <div className="w-full max-w-3xl space-y-3">
        <p className="text-sm text-muted-foreground text-center font-medium">
          Suggested prompts to get started:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
            <button
              key={text}
              onClick={() => onSelectPrompt(text)}
              className="record-card group text-left p-4 hover:scale-[1.02] transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                  <Icon className="w-4 h-4 text-cyan-500" />
                </div>
                <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                  {text}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
