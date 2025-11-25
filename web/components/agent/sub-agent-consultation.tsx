"use client";

import { useState } from "react";
import { Users, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  SubAgentConsultation,
  SubAgentConsultationItemProps,
} from "@/types/agent-ui";

export function SubAgentConsultationItem({
  consultation,
}: SubAgentConsultationItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-orange-500/30 rounded bg-orange-500/5 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 hover:bg-orange-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-orange-500" />
          <span className="font-mono font-medium text-orange-500">
            {consultation.agent}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 border-t border-orange-500/30 bg-background/30">
          <div className="text-[10px] text-muted-foreground mb-1 font-medium">
            Response
          </div>
          <div className="prose prose-xs dark:prose-invert max-w-none text-[10px] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {consultation.response}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
