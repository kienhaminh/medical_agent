"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Imaging } from "@/lib/api";
import { runSegmentation } from "@/lib/api";

interface ImagingAnalysisDialogProps {
  imaging: Imaging | null;
  patientId: number;
  onClose: () => void;
  onSegmentationComplete: (updated: Imaging) => void;
}

const LEGEND = [
  { label: "Tumor Core (TC)", color: "bg-red-500" },
  { label: "Edema (ED)", color: "bg-green-500" },
  { label: "Enhancing Tumor (ET)", color: "bg-blue-500" },
];

export function ImagingAnalysisDialog({
  imaging,
  patientId,
  onClose,
  onSegmentationComplete,
}: ImagingAnalysisDialogProps) {
  const [running, setRunning] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const onSegmentationCompleteRef = useRef(onSegmentationComplete);
  useEffect(() => { onSegmentationCompleteRef.current = onSegmentationComplete; });

  // Preload overlay image to prevent flicker on toggle
  const successResult =
    imaging?.segmentation_result?.status === "success"
      ? imaging.segmentation_result
      : null;

  useEffect(() => {
    if (successResult) {
      const img = new window.Image();
      img.src = successResult.artifacts.overlay_image.url;
    }
  }, [successResult]);

  // Reset state when imaging changes
  useEffect(() => {
    setRunning(false);
    setOverlayMode(false);
    setError(null);
  }, [imaging?.id]);

  // Escape key closes dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleRunSegmentation = useCallback(async () => {
    if (!imaging) return;
    setRunning(true);
    setError(null);
    try {
      const updated = await runSegmentation(patientId, imaging.id);
      onSegmentationCompleteRef.current(updated);
      setOverlayMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setRunning(false);
    }
  }, [imaging, patientId]);

  if (!imaging) return null;

  const segResult = successResult;

  const imageUrl =
    overlayMode && segResult
      ? segResult.artifacts.overlay_image.url
      : imaging.preview_url;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Imaging analysis: ${imaging.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {imaging.image_type}
          </span>
          <span className="text-sm font-semibold text-white">{imaging.title}</span>
          {segResult && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400">
              ✓ Segmented
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imaging.title}
          className="max-h-full max-w-full object-contain"
        />

        {/* Spinner overlay while running */}
        {running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <div className="h-9 w-9 rounded-full border-[3px] border-slate-700 border-t-blue-500 animate-spin" />
            <span className="text-sm text-slate-400">Running segmentation…</span>
          </div>
        )}

        {/* Original / Overlay toggle */}
        {segResult && !running && (
          <div className="absolute bottom-4 right-4 flex gap-1">
            <button
              type="button"
              onClick={() => setOverlayMode(false)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded transition-colors ${
                !overlayMode
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setOverlayMode(true)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded transition-colors ${
                overlayMode
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Overlay
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900 border-t border-slate-700 shrink-0 gap-4">
        {/* Legend */}
        <div
          className={`flex items-center gap-4 flex-wrap transition-opacity ${
            segResult ? "opacity-100" : "opacity-40"
          }`}
        >
          {LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Right: metadata + action */}
        <div className="flex items-center gap-3 shrink-0">
          {error ? (
            <span className="text-[11px] text-red-400">{error}</span>
          ) : segResult ? (
            <span className="text-[11px] text-slate-500">
              Slice {segResult.input.slice_index} · {segResult.model.architecture}
            </span>
          ) : null}

          {segResult ? (
            <button
              type="button"
              onClick={handleRunSegmentation}
              disabled={running}
              className="px-3 py-1.5 text-[11px] font-semibold rounded border border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↺ Re-run
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunSegmentation}
              disabled={running}
              className="px-4 py-1.5 text-[12px] font-bold rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▶ Run Segmentation
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
