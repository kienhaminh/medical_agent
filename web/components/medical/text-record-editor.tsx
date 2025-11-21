"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { addTextRecord } from "@/lib/api";
import type { MedicalRecord } from "@/lib/api";

interface TextRecordEditorProps {
  patientId: number;
  open: boolean;
  onClose: () => void;
  onSave: (record: MedicalRecord) => void;
}

export function TextRecordEditor({ patientId, open, onClose, onSave }: TextRecordEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Please provide both title and content");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const record = await addTextRecord(patientId, {
        title: title.trim(),
        content: content.trim(),
        description: description.trim() || undefined,
      });

      onSave(record);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    setDescription("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add Clinical Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title *</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Initial Consultation Notes"
              className="medical-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-description">Category (Optional)</Label>
            <Input
              id="note-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Consultation, Follow-up, Diagnosis"
              className="medical-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-content">Clinical Notes *</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter detailed clinical notes, observations, diagnosis, treatment plan..."
              rows={12}
              className="medical-input font-mono text-sm"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="secondary-button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim() || !content.trim()}
              className="primary-button"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Note"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
