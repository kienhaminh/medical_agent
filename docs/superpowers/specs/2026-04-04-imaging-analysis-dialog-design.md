# Imaging Analysis Dialog Design

**Date:** 2026-04-04  
**Status:** Approved

## Goal

When a doctor clicks an imaging tile in the Imaging tab of the patient card, a full-viewport dialog opens. The dialog shows the image, lets the doctor trigger BraTS segmentation, and displays the overlay result with tumor region labels. The doctor can also ask the AI agent to run segmentation automatically.

## Architecture

### New file
`web/components/doctor/imaging-analysis-dialog.tsx` — self-contained full-viewport modal component.

### Modified files

| File | Change |
|------|--------|
| `web/lib/api.ts` | Add `segmentation_result` to `Imaging` interface; add `SegmentationResult` type; add `runSegmentation()` API function |
| `web/components/doctor/patient-card-panel.tsx` | `ImagingTab`: on tile click open dialog instead of navigating to `original_url` |

---

## Data

### `SegmentationResult` TypeScript type (new, in `web/lib/api.ts`)

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

### `Imaging` interface update

Add `segmentation_result?: SegmentationResult | null` to the existing `Imaging` interface.

### `runSegmentation()` API function (new)

```ts
export async function runSegmentation(
  patientId: number,
  imagingId: number
): Promise<Imaging>
```

Calls `POST /api/patients/{patientId}/imaging/{imagingId}/segment`, returns updated `Imaging` record with populated `segmentation_result`.

---

## `ImagingAnalysisDialog` Component

### Props

```ts
interface ImagingAnalysisDialogProps {
  imaging: Imaging | null;       // null = dialog closed
  patientId: number;
  onClose: () => void;
  onSegmentationComplete: (updated: Imaging) => void;  // updates parent's imaging record
}
```

### Layout

Full-viewport fixed overlay (`fixed inset-0 z-50 flex flex-col bg-black`).

**Header** (slim, dark bar):
- Left: `image_type` label + title
- Right: "✓ Segmented" badge (shown only when `segmentation_result` exists), close button (×)

**Image area** (fills all remaining space, `flex-1`):
- Shows `preview_url` image by default (object-contain, black background)
- When segmented and Overlay mode active: shows `segmentation_result.artifacts.overlay_image.url`
- Original/Overlay toggle buttons — bottom-right corner of image area — only visible when `segmentation_result` exists
- Spinner overlay (covers image area only) while segmentation is running

**Bottom bar** (slim, dark bar):
- Left: tumor legend (Tumor Core=red, Edema=green, Enhancing Tumor=blue) — dimmed (opacity-40) when no segmentation
- Right:
  - Metadata text when segmented: `Slice {n} · {architecture}` — dimmed
  - **"▶ Run Segmentation"** button — shown when no `segmentation_result`
  - **"↺ Re-run"** button — shown when `segmentation_result` exists
  - Both buttons disabled (opacity-50, not-allowed cursor) while running

### States

| State | Image shown | Toggle visible | Button | Spinner |
|-------|-------------|----------------|--------|---------|
| No segmentation | preview_url | No | "▶ Run Segmentation" | No |
| Running | preview_url | No | disabled | Yes (image area) |
| Segmented, Original mode | preview_url | Yes | "↺ Re-run" | No |
| Segmented, Overlay mode | overlay_image.url | Yes | "↺ Re-run" | No |

### Behavior

- **Run Segmentation clicked:** set `running = true`, call `runSegmentation(patientId, imaging.id)`, on success call `onSegmentationComplete(updated)` and set Overlay mode active, set `running = false`. On error: show brief error text in bottom bar, re-enable button.
- **Close:** calls `onClose()`. Allowed at any time (even while running — doctor may close and let agent handle it).
- **Escape key:** closes the dialog.
- **Click outside:** does not close (full viewport, no backdrop click target).

---

## `ImagingTab` changes in `patient-card-panel.tsx`

`ImagingTab` currently delegates rendering to `PatientImagingPanel`. It will be rewritten to render tiles inline so click handlers can be attached.

- `useState<Imaging[]>` initialized from `props.imaging` — local copy so tiles update after segmentation without a page reload
- `useState<Imaging | null>(null)` for `dialogImaging`
- Each tile renders as a `<button>` (replacing the existing `<a href>` in `PatientImagingPanel`): clicking sets `dialogImaging`
- Tile appearance: same 2-column grid, preview image, type label, title — if `segmentation_result` exists show a small "✓" badge on the tile
- Render `<ImagingAnalysisDialog>` when `dialogImaging !== null`
- `onSegmentationComplete(updated)`: replace the matching record in local `imaging` state and update `dialogImaging` to the updated record
- `onClose`: set `dialogImaging = null`

---

## What Is Not Changing

- The backend `/segment` endpoint — unchanged
- `PatientImagingPanel` component — `ImagingTab` no longer calls it (tiles rendered inline); component file kept but unused here
- Agent integration — the agent already has `segment_image` tool; this dialog just exposes the same action to the doctor directly

## Out of Scope

- Slice navigation (scrubbing through z-slices)
- Downloading the predmask or overlay
- Displaying per-class pixel counts or volumetrics
