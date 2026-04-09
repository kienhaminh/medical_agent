"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface ClinicalNotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
}

function SaveStatusIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving...
      </span>
    );
  }
  if (saved) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <Check className="w-3 h-3" />
        Saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      Unsaved
    </span>
  );
}

// Markdown components using design-system tokens, optimised for clinical notes
const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-base font-semibold text-foreground mt-4 mb-1.5 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-sm font-semibold text-foreground mt-3 mb-1 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold text-foreground/80 mt-2.5 mb-1 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm text-foreground leading-6 my-1.5 first:mt-0" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-foreground/80" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-1.5 space-y-0.5 pl-4 list-disc marker:text-muted-foreground/50 text-sm" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-1.5 space-y-0.5 pl-4 list-decimal marker:text-muted-foreground/50 text-sm" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-foreground leading-6" {...props}>
      {children}
    </li>
  ),
  hr: ({ ...props }) => (
    <hr className="my-3 border-0 border-t border-border/50" {...props} />
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }) => (
    <code
      className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
      {...props}
    >
      {children}
    </code>
  ),
};

export function ClinicalNotesEditor({
  notes,
  onChange,
  saving,
  saved,
  disabled = false,
}: ClinicalNotesEditorProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditing((v) => !v)}
          disabled={disabled}
        >
          {isEditing ? (
            <>
              <Eye className="w-3 h-3" />
              Preview
            </>
          ) : (
            <>
              <Pencil className="w-3 h-3" />
              Edit
            </>
          )}
        </Button>
        <SaveStatusIndicator saving={saving} saved={saved} />
      </div>

      <div className="p-3 flex-1">
        {isEditing ? (
          <Textarea
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter clinical notes (SOAP format recommended)..."
            disabled={disabled}
            className="min-h-[300px] resize-y bg-card/50 border-border/50 focus:border-primary/50 text-sm leading-relaxed"
          />
        ) : (
          <div
            className="min-h-[300px] text-sm cursor-text"
            onClick={() => !disabled && setIsEditing(true)}
          >
            {notes.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {notes}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground/50 text-sm">
                Click to add clinical notes (SOAP format recommended)...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
