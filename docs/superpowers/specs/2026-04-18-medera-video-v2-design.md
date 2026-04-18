# MEDERA Promotion Video v2 — Design Spec

**Date:** 2026-04-18  
**Status:** Approved  
**Scope:** Remotion video at `video/`

---

## Overview

Rebuild the MEDERA promo video from v1 (65s, 6 scenes) to v2 (75s, 7 scenes). The narrative arc shifts from "feature dump" to "Problem → Solution → Feature Tour → CTA". Five distinct hospital workflows are demonstrated: patient intake, doctor workspace, AI assistant, MRI segmentation, and admin operations dashboard.

---

## Architecture

### Composition Changes

| File | Change |
|------|--------|
| `src/Root.tsx` | Update `durationInFrames` 1950 → 2250 |
| `src/DemoVideo.tsx` | Rewire Series with 7 scenes at exact spec frame offsets |
| `src/data/script.ts` | Replace all text content with v2 copy |

### Scene Manifest

| Scene ID | File | Frames | Start |
|----------|------|--------|-------|
| `problem-hook` | `scenes/problem-hook.tsx` | 180 | 0 |
| `brand-reveal` | `scenes/brand-reveal.tsx` | 210 | 180 |
| `smart-intake` | `scenes/smart-intake.tsx` | 450 | 390 |
| `doctor-workspace` | `scenes/doctor-workspace.tsx` | 510 | 840 |
| `mri-segmentation` | `scenes/mri-segmentation.tsx` | 330 | 1350 |
| `admin-dashboard` | `scenes/admin-dashboard.tsx` | 270 | 1680 |
| `closing-cta` | `scenes/closing-cta.tsx` | 300 | 1950 |

All v1 scene files (`logo-reveal`, `agent-intro`, `patient-screening`, `routing-and-support`, `agent-advantages`) are deleted.

### New Components (7)

| Component | File | Purpose |
|-----------|------|---------|
| ProblemTextSequence | `components/problem-text-sequence.tsx` | Sequential fade-in lines on dark bg |
| MriVisualization | `components/mri-visualization.tsx` | Brain slice placeholder + animated color overlay layers |
| SegmentationLegend | `components/segmentation-legend.tsx` | Color-coded tumor region labels |
| KanbanBoard | `components/kanban-board.tsx` | Columns + cards + live card-move animation |
| KpiBar | `components/kpi-bar.tsx` | Horizontal metrics with count-up animation |
| ProcessingIndicator | `components/processing-indicator.tsx` | Pulsing dots loading state |
| FeatureRecapRow | `components/feature-recap-row.tsx` | Horizontal icon+label strip |

### Reused Components (unchanged)

`logo-assembly`, `typewriter`, `message-bubble`, `fade-slide`, `floating-screen`, `b-roll-layer`, `particle-network`, `dna-helix`, `pulse-wave`, `dot-matrix-bg`, `scan-line-overlay`, `feature-callout`, `advantage-card` (adapted), `cursor-click`, `iphone-frame`

### New Dependency

`lucide-react` — for all icons (stethoscope, routing, brain, scan, layout, bar-chart, plus, etc.)

---

## Scene Designs

### Scene 1 — Problem Hook (frames 0–179)
Dark background (#0a0e17), subtle ECG flatline b-roll at 15% opacity. Three lines fade-slide-up sequentially:
1. "Patients wait. Paperwork piles up." — enters f15, grey (#94a3b8)
2. "Doctors juggle 5 apps to see one patient." — enters f50
3. "There has to be a better way." — enters f100, white, bold 44px

Transition: `fadeToWhite` f155–179.

### Scene 2 — Brand Reveal (frames 180–389)
Dark-to-light gradient bg. Particles converge → logo forms (f0–70). Typewriter tagline "One AI Agent. The Entire Hospital Workflow." enters f85. Four feature icons (stethoscope/routing/brain/scan) spring-scale-up at f140 with 12-frame stagger.

### Scene 3 — Smart Intake (frames 390–839)
Light bg. iPhone-framed chat interface pans down. Three messages (assistant/user/assistant) typewrite in sequence. Intake form slides up at f180 with 3 fields auto-filling. Submit button at f310, triage result card (green border, "Cardiology — Urgent") bounces in at f340.

### Scene 4 — Doctor Workspace (frames 840–1349)
Desktop floating screen. Three sequential beats with camera pan focus:

- **Beat 1 (f0–149):** Left panel — patient queue with 3 patients. Sarah Chen selected + glow. Cursor clicks "Accept Patient" at f100.
- **Beat 2 (f150–309):** Center panel — patient header card, vitals (BP/HR/SpO2/Temp) stagger in, AI pre-visit brief typewriters, suggested orders slide up.
- **Beat 3 (f310–509):** Right panel — doctor types query, 3 tool calls animate (running → done), AI response typewriters, "Place Order" button pulses.

### Scene 5 — MRI Segmentation (frames 1350–1679)
Dark bg. Doctor command typewriters at f20. Processing indicator (pulsing dots, "Analyzing 4 MRI modalities...") f80–130. MRI brain slice (radial gradient placeholder, 600×600) fades in at f130. Three color overlay layers paint on from center:
- Necrotic Core (red, #dc2626) — f160
- Peritumoral Edema (green, #22c55e) — f180
- Enhancing Tumor (blue, #3b82f6) — f200

Legend slides in right-of-image at f240. Metadata text at f260.

### Scene 6 — Admin Dashboard (frames 1680–1949)
Light bg, desktop frame. KPI bar (4 metrics, count-up) at f20. Kanban board (4 columns) slides up staggered at f60. Live card: "A. Foster" moves from Triaged → In Department at f170 with slide-across animation.

### Scene 7 — Closing CTA (frames 1950–2249)
Light-to-dark gradient. Feature recap row (4 icons) springs in at f15, exits at f120. Logo assembly reconverges at f100. Tagline "INTELLIGENT HEALTHCARE, AUTOMATED." typewriters at f160 with cyan-teal gradient. URL "medera.ai" fades in at f220.

---

## B-Roll Layer

`b-roll-layer.tsx` receives updated opacity keyframes matching the 7-scene structure per the spec:
`0→0.15, 180→0.35, 390→0.10, 840→0.08, 1350→0.12, 1680→0.08, 1950→0.40, 2250→0.35`

---

## Data / Content

`src/data/script.ts` updated with all v2 text, patient data, tool call names, and demo values. No hardcoded strings in scene files.

---

## Dependencies

```bash
npm install lucide-react
```

---

## Out of Scope

- Actual MRI DICOM images (placeholder gradient used)
- Real particle physics for logo (existing `logo-assembly` reused)
- Audio/voiceover
