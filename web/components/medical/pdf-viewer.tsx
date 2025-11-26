"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Download } from "lucide-react";
import type { MedicalRecord } from "@/lib/api";

interface PdfViewerProps {
  record: MedicalRecord;
  open: boolean;
  onClose: () => void;
  onAnalyze?: (record: MedicalRecord) => void;
}

export function PdfViewer({
  record,
  open,
  onClose,
  onAnalyze,
}: PdfViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0">
        <DialogTitle className="sr-only">{record.title}</DialogTitle>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-semibold">
                {record.title}
              </h2>
              {record.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {record.description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card/30">
            <div className="text-sm text-muted-foreground">PDF Lab Report</div>

            <div className="flex items-center gap-2">
              {record.file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(record.file_url, "_blank")}
                  className="secondary-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              {onAnalyze && (
                <Button
                  onClick={() => onAnalyze(record)}
                  className="primary-button"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze with AI
                </Button>
              )}
            </div>
          </div>

          {/* PDF Display */}
          <div className="flex-1 overflow-hidden">
            {record.file_url ? (
              <iframe
                src={record.file_url}
                className="w-full h-full"
                title={record.title}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No PDF available</p>
              </div>
            )}
          </div>

          {/* Metadata Footer */}
          <div className="flex items-center gap-6 px-4 py-3 border-t border-border bg-card/30 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Type:</span>{" "}
              <span className="medical-badge medical-badge-lab">
                LAB REPORT
              </span>
            </div>
            <div>
              <span className="font-medium">Uploaded:</span>{" "}
              {new Date(record.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
