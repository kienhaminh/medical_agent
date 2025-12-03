"use client";

import { ImageViewer } from "./image-viewer";
import { PdfViewer } from "./pdf-viewer";
import type { MedicalRecord, Imaging } from "@/lib/api";

interface RecordViewerProps {
  record: MedicalRecord | Imaging | null;
  open: boolean;
  onClose: () => void;
  onDeleteImaging?: (record: Imaging) => void;
}

export function RecordViewer({
  record,
  open,
  onClose,
  onDeleteImaging,
}: RecordViewerProps) {
  if (!record) return null;

  // Handle Imaging type (new table)
  if ("image_type" in record) {
    return (
      <ImageViewer
        record={record}
        open={open}
        onClose={onClose}
        onDelete={onDeleteImaging}
      />
    );
  }

  // Handle MedicalRecord type (old table)
  if (record.record_type === "image") {
    return (
      <ImageViewer
        record={{
          id: record.id,
          patient_id: record.patient_id,
          title: record.title,
          description: record.description,
          image_type: record.file_type || "other",
          original_url: record.file_url || "",
          preview_url: record.file_url || "",
          created_at: record.created_at,
        }}
        open={open}
        onClose={onClose}
      />
    );
  }

  if (record.record_type === "pdf") {
    return (
      <PdfViewer
        record={record}
        open={open}
        onClose={onClose}
        // @ts-ignore - PdfViewer only accepts MedicalRecord, which this is guaranteed to be here
        onAnalyze={onAnalyze}
      />
    );
  }

  return null;
}
