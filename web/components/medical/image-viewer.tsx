"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, X, Sparkles } from "lucide-react";
import type { MedicalRecord } from "@/lib/api";

interface ImageViewerProps {
  record: MedicalRecord;
  open: boolean;
  onClose: () => void;
  onAnalyze?: (record: MedicalRecord) => void;
}

export function ImageViewer({ record, open, onClose, onAnalyze }: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 400));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));
  const handleReset = () => {
    setZoom(100);
    setBrightness(100);
    setContrast(100);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0">
        <DialogTitle className="sr-only">{record.title}</DialogTitle>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-semibold">{record.title}</h2>
              {record.description && (
                <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card/30">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                className="secondary-button"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-mono w-16 text-center">{zoom}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                className="secondary-button"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="secondary-button ml-2"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Brightness</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Contrast</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>

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

          {/* Image Display */}
          <div className="flex-1 overflow-auto bg-black/90 p-4">
            <div className="flex items-center justify-center min-h-full">
              {record.file_url ? (
                <img
                  src={record.file_url}
                  alt={record.title}
                  style={{
                    transform: `scale(${zoom / 100})`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                    transition: "all 0.2s ease",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                  className="object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>No image available</p>
                </div>
              )}
            </div>
          </div>

          {/* Metadata Footer */}
          <div className="flex items-center gap-6 px-4 py-3 border-t border-border bg-card/30 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Type:</span>{" "}
              <span className={`medical-badge medical-badge-${record.file_type || "other"}`}>
                {record.file_type?.toUpperCase() || "IMAGE"}
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
