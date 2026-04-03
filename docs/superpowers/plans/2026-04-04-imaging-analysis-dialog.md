# Imaging Analysis Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-viewport imaging analysis dialog to the doctor portal that lets doctors view BraTS segmentation overlays and trigger segmentation with a button click.

**Architecture:** Three tasks in sequence: (1) expand the `SegmentationResult` type and add `runSegmentation()` to `api.ts`, (2) build the new `ImagingAnalysisDialog` component, (3) rewrite `ImagingTab` in `patient-card-panel.tsx` to render inline tiles with click-to-open dialog. No backend changes needed — `POST /api/patients/{id}/imaging/{imgId}/segment` already exists.

**Tech Stack:** Next.js 15, React, Tailwind CSS, Lucide icons. No test framework in the web package.

---

## File Map

| Action | File |
|--------|------|
| Modify | `web/lib/api.ts` |
| Create | `web/components/doctor/imaging-analysis-dialog.tsx` |
| Modify | `web/components/doctor/patient-card-panel.tsx` (`ImagingTab` only) |

---

## Task 1: Expand `SegmentationResult` type and add `runSegmentation()` API call

**Files:**
- Modify: `web/lib/api.ts`

### Context

`SegmentationResult` already exists at line 81 of `web/lib/api.ts` but is minimal:
```ts
export interface SegmentationResult {
  status: string;
  artifacts?: {
    overlay_image?: { url: string };
    predmask_image?: { url: string };
  };
  prediction?: { pred_classes_in_slice?: number[] };
}
```

`Imaging` already has `segmentation_result?: SegmentationResult | null` at line 99.

The backend `POST /api/patients/{patientId}/imaging/{imagingId}/segment` endpoint returns an updated `Imaging` record (same shape as `GET /api/patients/{id}`). The API base URL is `http://localhost:8000/api` (top of `api.ts`). All other fetch calls in `api.ts` use plain `fetch` without auth headers.

- [ ] **Step 1: Replace the `SegmentationResult` interface with the full type**

In `web/lib/api.ts`, replace:
```ts
export interface SegmentationResult {
  status: string;
  artifacts?: {
    overlay_image?: { url: string };
    predmask_image?: { url: string };
  };
  prediction?: { pred_classes_in_slice?: number[] };
}
```
With:
```ts
export interface SegmentationResult {
  status: "success" | "error";
  patient_id: string;
  input: {
    image_url: string;
    shape_zyx: [number, number, number];
    slice_index: number;
  };
  model: {
    architecture: string;
    device: string;
  };
  prediction: {
    pred_classes_in_slice: number[];
  };
  artifacts: {
    overlay_image: { url: string };
    predmask_image: { url: string };
  };
}
```

- [ ] **Step 2: Add `runSegmentation()` after the `getPatient` function**

Find `getPatient` in `web/lib/api.ts` (around line 112). After its closing brace, add:

```ts
export async function runSegmentation(
  patientId: number,
  imagingId: number
): Promise<Imaging> {
  const res = await fetch(
    `${API_BASE_URL}/patients/${patientId}/imaging/${imagingId}/segment`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Segmentation failed");
  return res.json();
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "intake-chat"
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add web/lib/api.ts
git commit -m "feat(api): expand SegmentationResult type and add runSegmentation()"
```

---

## Task 2: Create `ImagingAnalysisDialog` component

**Files:**
- Create: `web/components/doctor/imaging-analysis-dialog.tsx`

### Context

Full-viewport fixed modal. Three states: no segmentation, running, segmented. Image fills all available space between header and bottom bar. The `runSegmentation` function comes from `@/lib/api`.

The bottom bar bottom-right shows:
- "▶ Run Segmentation" button when `segmentation_result` is null/undefined
- "↺ Re-run" button when `segmentation_result` exists
- Both disabled while `running === true`

When segmented, an Original/Overlay toggle appears bottom-right of the image area. Clicking Original shows `imaging.preview_url`; clicking Overlay shows `imaging.segmentation_result.artifacts.overlay_image.url`.

On error, show a red error message in the bottom bar in place of the metadata text, and re-enable the button.

Escape key closes the dialog via a `useEffect` keydown listener.

- [ ] **Step 1: Create the file**

Create `/Users/kien.ha/Code/medical_agent/web/components/doctor/imaging-analysis-dialog.tsx` with this exact content:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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

  // Reset state when imaging changes
  useEffect(() => {
    setRunning(false);
    setOverlayMode(false);
    setError(null);
  }, [imaging?.id]);

  // Escape key closes dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleRunSegmentation = useCallback(async () => {
    if (!imaging) return;
    setRunning(true);
    setError(null);
    try {
      const updated = await runSegmentation(patientId, imaging.id);
      onSegmentationComplete(updated);
      setOverlayMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segmentation failed");
    } finally {
      setRunning(false);
    }
  }, [imaging, patientId, onSegmentationComplete]);

  if (!imaging) return null;

  const hasSegmentation = !!imaging.segmentation_result;
  const imageUrl =
    overlayMode && hasSegmentation
      ? imaging.segmentation_result!.artifacts.overlay_image.url
      : imaging.preview_url;

  const segResult = imaging.segmentation_result;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
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
        {hasSegmentation && !running && (
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
        <div className={`flex items-center gap-4 flex-wrap transition-opacity ${hasSegmentation ? "opacity-100" : "opacity-40"}`}>
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

          {hasSegmentation ? (
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
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "intake-chat"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add web/components/doctor/imaging-analysis-dialog.tsx
git commit -m "feat(doctor): add ImagingAnalysisDialog with segmentation overlay"
```

---

## Task 3: Rewrite `ImagingTab` in `patient-card-panel.tsx`

**Files:**
- Modify: `web/components/doctor/patient-card-panel.tsx`

### Context

Current `ImagingTab` (line 272–277):
```tsx
function ImagingTab({ imaging }: { imaging?: Imaging[] }) {
  if (!imaging?.length) {
    return <p className="text-xs text-muted-foreground">No imaging on file.</p>;
  }
  return <PatientImagingPanel imaging={imaging} />;
}
```

This delegates to `PatientImagingPanel` which wraps tiles in `<a href>` links. We need inline tiles with click handlers, local state for updates, and the dialog.

`patientId` is not currently passed to `ImagingTab`. It lives in the parent `PatientCardPanel` component as `patient.id`. We need to thread it down.

Current call site in `PatientCardPanel` (line ~116):
```tsx
{tab === "imaging" && <ImagingTab imaging={patient.imaging} />}
```

The `ImagingAnalysisDialog` is imported from `@/components/doctor/imaging-analysis-dialog`.

The `PatientImagingPanel` import at line 7 of `patient-card-panel.tsx` can be removed after this change.

- [ ] **Step 1: Add `ImagingAnalysisDialog` import and remove `PatientImagingPanel` import**

In `web/components/doctor/patient-card-panel.tsx`, replace:
```ts
import { PatientImagingPanel } from "@/components/doctor/patient-imaging-panel";
```
With:
```ts
import { ImagingAnalysisDialog } from "@/components/doctor/imaging-analysis-dialog";
```

- [ ] **Step 2: Update the `ImagingTab` call site to pass `patientId`**

In `PatientCardPanel`, replace:
```tsx
{tab === "imaging" && <ImagingTab imaging={patient.imaging} />}
```
With:
```tsx
{tab === "imaging" && <ImagingTab imaging={patient.imaging} patientId={patient.id} />}
```

- [ ] **Step 3: Replace the `ImagingTab` function**

Replace the entire `ImagingTab` function (lines 270–277) with:

```tsx
// --- Imaging tab ---

function ImagingTab({
  imaging: initialImaging,
  patientId,
}: {
  imaging?: Imaging[];
  patientId: number;
}) {
  const [imaging, setImaging] = useState<Imaging[]>(initialImaging ?? []);
  const [dialogImaging, setDialogImaging] = useState<Imaging | null>(null);

  if (!imaging.length) {
    return <p className="text-xs text-muted-foreground">No imaging on file.</p>;
  }

  const handleSegmentationComplete = (updated: Imaging) => {
    setImaging((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
    setDialogImaging(updated);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {imaging.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setDialogImaging(img)}
            className="group relative overflow-hidden rounded-md border border-border bg-muted/30 transition hover:border-primary/40 text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.preview_url}
              alt={img.title}
              className="h-24 w-full object-contain bg-black/5"
            />
            <div className="border-t px-1.5 py-1 text-[10px] leading-tight">
              <span className="font-medium uppercase text-foreground/90">{img.image_type}</span>
              <span className="block truncate text-muted-foreground">{img.title}</span>
            </div>
            {img.segmentation_result && (
              <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1 py-px rounded">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">Click a tile to open and analyze.</p>

      <ImagingAnalysisDialog
        imaging={dialogImaging}
        patientId={patientId}
        onClose={() => setDialogImaging(null)}
        onSegmentationComplete={handleSegmentationComplete}
      />
    </>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/kien.ha/Code/medical_agent/web && npx tsc --noEmit 2>&1 | grep -v "intake-chat"
```

Expected: no output.

- [ ] **Step 5: Manual smoke test**

1. Run `cd /Users/kien.ha/Code/medical_agent/web && npm run dev`
2. Open `http://localhost:3000/doctor` and log in as a doctor
3. Select a patient with imaging records
4. Click the **Imaging** tab in the patient card
5. Verify tiles render in a 2-column grid with preview images
6. Click a tile → full-viewport dialog opens with the image
7. Bottom bar shows "▶ Run Segmentation" button
8. Click the button → spinner appears over image area, button disabled
9. On success: overlay image shows, Original/Overlay toggle appears, "↺ Re-run" replaces button, tile in grid shows green "✓" badge
10. Press Escape → dialog closes
11. Click tile again → dialog opens in Original mode (state resets on each open), ✓ badge is visible on the tile
12. Click Original toggle → shows preview_url image

- [ ] **Step 6: Commit**

```bash
cd /Users/kien.ha/Code/medical_agent
git add web/components/doctor/patient-card-panel.tsx
git commit -m "feat(doctor): rewrite ImagingTab with inline tiles and analysis dialog"
```
