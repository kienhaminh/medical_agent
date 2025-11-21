"use client";

import { ImageViewer } from "./image-viewer";
import { PdfViewer } from "./pdf-viewer";
import type { MedicalRecord } from "@/lib/api";

interface RecordViewerProps {
  record: MedicalRecord | null;
  open: boolean;
  onClose: () => void;
  onAnalyze?: (record: MedicalRecord) => void;
}

export function RecordViewer({ record, open, onClose, onAnalyze }: RecordViewerProps) {
  if (!record) return null;

  if (record.record_type === "image") {
    return (
      <ImageViewer
        record={record}
        open={open}
        onClose={onClose}
        onAnalyze={onAnalyze}
      />
    );
  }

  if (record.record_type === "pdf") {
    return (
      <PdfViewer
        record={record}
        open={open}
        onClose={onClose}
        onAnalyze={onAnalyze}
      />
    );
  }

  return null;
}
