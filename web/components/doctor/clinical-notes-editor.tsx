"use client";

import { useState } from "react";
import { FileEdit, Check, Loader2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ConversationRecorder } from "./conversation-recorder";
import { LiveTranscriptPreview } from "./live-transcript-preview";

interface ClinicalNotesEditorProps {
  notes: string;
  onChange: (notes: string) => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
  onDraftWithAI?: () => void;
  drafting?: boolean;
  visitId?: number;
}

/** Indicator dot/icon for the current save state. */
function SaveStatusIndicator({
  saving,
  saved,
}: {
  saving: boolean;
  saved: boolean;
}) {
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

  // Unsaved changes
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      Unsaved
    </span>
  );
}

export function ClinicalNotesEditor({
  notes,
  onChange,
  saving,
  saved,
  disabled = false,
  onDraftWithAI,
  drafting = false,
  visitId,
}: ClinicalNotesEditorProps) {
  const [liveText, setLiveText] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const handleLiveText = (text: string) => {
    setLiveText(text);
  };

  const handleLiveStateChange = (live: boolean, refining: boolean) => {
    setIsLive(live);
    setIsRefining(refining);
    if (!live && !refining) {
      setLiveText("");
    }
  };

  const handleTranscribed = (text: string) => {
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp}] Recording transcript:\n${text}`;
    onChange(notes ? `${notes}\n\n${entry}` : entry);
  };

  return (
    <div className="overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3 px-3 py-2 border-b border-border/50">
        {visitId && (
          <ConversationRecorder
            visitId={visitId}
            disabled={disabled}
            onTranscribed={handleTranscribed}
            onLiveText={handleLiveText}
            onLiveStateChange={handleLiveStateChange}
          />
        )}
        {onDraftWithAI && (
          <button
            type="button"
            onClick={onDraftWithAI}
            disabled={disabled || drafting}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {drafting ? "Drafting..." : "Draft with AI"}
          </button>
        )}
        <SaveStatusIndicator saving={saving} saved={saved} />
      </div>

      {/* Live transcript preview */}
      {(isLive || isRefining) && (
        <LiveTranscriptPreview text={liveText} isRefining={isRefining} />
      )}

      {/* Editor */}
      <div className="p-3 flex-1">
        <Textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter clinical notes (SOAP format recommended)..."
          disabled={disabled}
          className="min-h-[300px] resize-y bg-card/50 border-border/50 focus:border-cyan-500/50 text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}
