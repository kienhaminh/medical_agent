"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, Layers } from "lucide-react";
import type { Imaging } from "@/lib/api";
import { runSegmentation } from "@/lib/api";

interface ImagingAnalysisDialogProps {
  /** All imaging records in the study group (typically 4 BraTS modalities). */
  imagingGroup: Imaging[];
  patientId: number;
  onClose: () => void;
  onSegmentationComplete: (updated: Imaging) => void;
}

// BraTS segmentation class colors — medical imaging standard, not UI theme colors
const LEGEND = [
  { label: "Tumor Core (TC)", color: "bg-red-500" },
  { label: "Edema (ED)", color: "bg-green-500" },
  { label: "Enhancing Tumor (ET)", color: "bg-blue-500" },
];

// Per-modality accent colors for the thumbnail strip
const MODALITY_BORDER: Record<string, string> = {
  t1:    "border-sky-500",
  t1ce:  "border-amber-500",
  t2:    "border-emerald-500",
  flair: "border-violet-500",
};
const MODALITY_TEXT: Record<string, string> = {
  t1:    "text-sky-400",
  t1ce:  "text-amber-400",
  t2:    "text-emerald-400",
  flair: "text-violet-400",
};

const VALID_MODALITIES = ["t1", "t1ce", "t2", "flair"];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.3;
const RESET_VIEW = { zoom: 1, x: 0, y: 0 };

export function ImagingAnalysisDialog({
  imagingGroup,
  patientId,
  onClose,
  onSegmentationComplete,
}: ImagingAnalysisDialogProps) {
  // Internal group state — updated after segmentation without requiring parent re-open
  const [group, setGroup] = useState<Imaging[]>(imagingGroup);
  const [selectedId, setSelectedId] = useState<number | null>(imagingGroup[0]?.id ?? null);
  const [overlayMode, setOverlayMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState(RESET_VIEW);
  const [isDragging, setIsDragging] = useState(false);

  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; });

  const imageAreaRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const onSegmentationCompleteRef = useRef(onSegmentationComplete);
  useEffect(() => { onSegmentationCompleteRef.current = onSegmentationComplete; });

  const selectedImaging = group.find((img) => img.id === selectedId) ?? group[0];
  // The record that holds the segmentation result (only one per-run)
  const segmentedImaging = group.find(
    (img) => img.segmentation_result?.status === "success"
  );
  const segResult =
    segmentedImaging?.segmentation_result?.status === "success"
      ? segmentedImaging.segmentation_result
      : null;

  // First valid-modality image — used as the entry point for the backend call
  const primaryForSeg =
    group.find((img) => VALID_MODALITIES.includes(img.image_type.toLowerCase())) ??
    group[0];

  // Preload overlay to prevent flicker on toggle
  useEffect(() => {
    if (segResult) {
      const img = new window.Image();
      img.src = segResult.artifacts.overlay_image.url;
    }
  }, [segResult]);

  // Reset view when switching modalities (overlay mode stays if already active)
  useEffect(() => {
    setView(RESET_VIEW);
  }, [selectedId]);

  // Escape key closes dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Non-passive wheel handler for zoom-toward-cursor
  useEffect(() => {
    const el = imageAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const scale = newZoom / v.zoom;
      setView({ zoom: newZoom, x: cx + scale * (v.x - cx), y: cy + scale * (v.y - cy) });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleRunSegmentation = useCallback(async () => {
    if (!primaryForSeg) return;
    setRunning(true);
    setError(null);
    try {
      const updated = await runSegmentation(patientId, primaryForSeg.id);
      // Update internal group state so UI reflects results without closing dialog
      setGroup((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
      onSegmentationCompleteRef.current(updated);
      // Switch to the segmented record and show the overlay
      setSelectedId(updated.id);
      setOverlayMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setRunning(false);
    }
  }, [primaryForSeg, patientId]);

  if (!group.length || !selectedImaging) return null;

  // Main view image: overlay when toggled, otherwise selected modality preview
  const previewUrl =
    selectedImaging.aligned_preview_url ?? selectedImaging.preview_url;
  const imageUrl =
    overlayMode && segResult
      ? segResult.artifacts.overlay_image.url
      : previewUrl;

  const isDefaultView = view.zoom === 1 && view.x === 0 && view.y === 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BraTS MRI Study Viewer"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#09090f", fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0d0d17" }}
      >
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
            BraTS MRI Study
          </span>
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
            {selectedImaging.title}
          </span>
          {segResult && (
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ border: "1px solid rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.08)", color: "#6ee7b7" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              SEGMENTED
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 transition-opacity opacity-30 hover:opacity-80"
          style={{ color: "white" }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Main image area ─────────────────────────────────────── */}
      <div
        ref={imageAreaRef}
        className="flex-1 min-h-0 relative overflow-hidden select-none"
        style={{ background: "#050508", cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          setIsDragging(true);
          dragStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onMouseMove={(e) => {
          if (!isDragging) return;
          setView((v) => ({
            ...v,
            x: dragStart.current.vx + (e.clientX - dragStart.current.x),
            y: dragStart.current.vy + (e.clientY - dragStart.current.y),
          }));
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        {/* Subtle PACS grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/*
          Absolute inset-0 + w-full h-full + object-contain ensures both the preview
          and the overlay image are always rendered within the same CSS box, so toggling
          between them never causes a size jump regardless of their intrinsic dimensions.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={selectedImaging.title}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: "center",
            transition: isDragging ? "none" : "transform 0.05s ease-out",
          }}
        />

        {/* Processing overlay */}
        {running && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "rgba(5,5,8,0.85)", backdropFilter: "blur(4px)" }}
          >
            <div className="relative">
              <div
                className="h-12 w-12 rounded-full animate-spin"
                style={{ border: "2px solid rgba(255,255,255,0.06)", borderTopColor: "#60a5fa" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Layers className="h-4 w-4" style={{ color: "rgba(96,165,250,0.6)" }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
                Processing
              </p>
              <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                Running BraTS segmentation across all {group.length} modalities…
              </p>
            </div>
          </div>
        )}

        {/* Zoom controls — bottom-left */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.max(MIN_ZOOM, v.zoom / ZOOM_STEP) }))
            }
            className="p-1.5 rounded transition-opacity opacity-40 hover:opacity-80"
            style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.6)", color: "white" }}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView(RESET_VIEW)}
            className="px-2 py-1 text-[11px] font-bold rounded transition-all"
            style={{
              border: isDefaultView ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(96,165,250,0.4)",
              background: isDefaultView ? "rgba(0,0,0,0.6)" : "rgba(96,165,250,0.1)",
              color: isDefaultView ? "rgba(255,255,255,0.4)" : "#93c5fd",
            }}
            aria-label="Reset zoom"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, v.zoom * ZOOM_STEP) }))
            }
            className="p-1.5 rounded transition-opacity opacity-40 hover:opacity-80"
            style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.6)", color: "white" }}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Preview / Overlay toggle — bottom-right */}
        {segResult && !running && (
          <div className="absolute bottom-4 right-4 flex items-center gap-0.5">
            {segResult.input?.slice_index !== undefined && (
              <span className="mr-2 text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                slice {segResult.input.slice_index}
              </span>
            )}
            <div
              className="flex rounded overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.6)" }}
            >
              <button
                type="button"
                onClick={() => setOverlayMode(false)}
                className="px-3 py-1.5 text-[10px] font-bold tracking-wider transition-colors"
                style={{
                  background: !overlayMode ? "rgba(255,255,255,0.1)" : "transparent",
                  color: !overlayMode ? "white" : "rgba(255,255,255,0.3)",
                }}
              >
                PREVIEW
              </button>
              <button
                type="button"
                onClick={() => setOverlayMode(true)}
                className="px-3 py-1.5 text-[10px] font-bold tracking-wider transition-colors"
                style={{
                  background: overlayMode ? "rgba(96,165,250,0.15)" : "transparent",
                  color: overlayMode ? "#93c5fd" : "rgba(255,255,255,0.3)",
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                OVERLAY
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modality strip ──────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0c0c15" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[9px] font-bold tracking-[0.25em] uppercase shrink-0"
            style={{ color: "rgba(255,255,255,0.18)" }}
          >
            Modalities
          </span>
          <div className="flex gap-2 flex-1 min-w-0">
            {group.map((img) => {
              const modKey = img.image_type.toLowerCase();
              const isSelected = img.id === selectedId;
              const borderColor = MODALITY_BORDER[modKey] ?? "border-white/20";
              const textColor = MODALITY_TEXT[modKey] ?? "text-white/40";

              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedId(img.id)}
                  className={`relative flex-1 min-w-0 rounded overflow-hidden border-2 transition-all ${
                    isSelected ? `${borderColor} opacity-100` : "border-white/10 opacity-40 hover:opacity-70"
                  }`}
                  style={{ maxWidth: 140 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview_url}
                    alt={img.image_type}
                    draggable={false}
                    className="w-full object-contain bg-black"
                    style={{ height: 64 }}
                  />
                  <div
                    className="px-1.5 py-1"
                    style={{ background: "rgba(0,0,0,0.7)" }}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider ${
                        isSelected ? textColor : "text-white/40"
                      }`}
                    >
                      {img.image_type}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-2.5 gap-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "#09090f" }}
      >
        {/* BraTS legend */}
        <div
          className={`flex items-center gap-5 flex-wrap transition-opacity ${
            segResult ? "opacity-100" : "opacity-25"
          }`}
        >
          {LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              <span className={`w-2 h-2 rounded-sm shrink-0 ${color}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {error && (
            <span className="text-[11px] text-red-400">{error}</span>
          )}
          {segResult && (
            <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.22)" }}>
              {segResult.model?.architecture ?? ""}
            </span>
          )}

          {segResult ? (
            <button
              type="button"
              onClick={handleRunSegmentation}
              disabled={running}
              className="px-3 py-1.5 text-[10px] font-bold tracking-wider rounded uppercase transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.45)" }}
            >
              ↺ Re-run
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunSegmentation}
              disabled={running || !primaryForSeg}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider rounded uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "#2563eb", color: "white" }}
            >
              <Layers className="h-3.5 w-3.5" />
              Run BraTS Segmentation
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
