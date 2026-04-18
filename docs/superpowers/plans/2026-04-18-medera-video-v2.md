# MEDERA Promotion Video v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the MEDERA promo video from v1 (65s, 6 scenes) to v2 (75s, 7 scenes) per the approved design spec.

**Architecture:** All work is inside `video/`. Each scene is a self-contained React component rendered by Remotion. New components live in `video/src/components/`. DemoVideo.tsx wires all scenes together using `<Series>`. The global `BRollLayer` keyframes are updated to match v2's 7-scene structure.

**Tech Stack:** Remotion 4.x, React 19, TypeScript 5, lucide-react (new), JetBrains Mono font

---

## File Map

### Create
- `video/src/components/problem-text-sequence.tsx` — sequential text fade-in for dark bg
- `video/src/components/processing-indicator.tsx` — pulsing dots loading state
- `video/src/components/kpi-bar.tsx` — horizontal metrics with count-up
- `video/src/components/segmentation-legend.tsx` — color-coded MRI label list
- `video/src/components/feature-recap-row.tsx` — icon+label closing strip
- `video/src/components/mri-visualization.tsx` — brain SVG + animated color overlays
- `video/src/components/kanban-board.tsx` — columns + cards + live card-move animation
- `video/src/scenes/problem-hook.tsx` — Scene 1
- `video/src/scenes/brand-reveal.tsx` — Scene 2
- `video/src/scenes/smart-intake.tsx` — Scene 3
- `video/src/scenes/doctor-workspace.tsx` — Scene 4
- `video/src/scenes/mri-segmentation.tsx` — Scene 5
- `video/src/scenes/admin-dashboard.tsx` — Scene 6
- `video/src/scenes/closing-cta.tsx` — Scene 7

### Modify
- `video/package.json` — add lucide-react
- `video/src/Root.tsx` — durationInFrames 1950 → 2250
- `video/src/data/script.ts` — replace all content with v2 copy
- `video/src/DemoVideo.tsx` — swap 6 old scenes for 7 new scenes, update b-roll keyframes

### Delete
- `video/src/scenes/logo-reveal.tsx`
- `video/src/scenes/agent-intro.tsx`
- `video/src/scenes/patient-screening.tsx`
- `video/src/scenes/routing-and-support.tsx`
- `video/src/scenes/agent-advantages.tsx`
(closing-cta.tsx is replaced in place — the new file goes to the same path)

---

## Task 1: Setup — install lucide-react, update Root.tsx, update script.ts

**Files:**
- Modify: `video/package.json`
- Modify: `video/src/Root.tsx`
- Modify: `video/src/data/script.ts`

- [ ] **Step 1: Install lucide-react**

```bash
cd video && npm install lucide-react
```

Expected output: `added 1 package` (lucide-react is dependency-free)

- [ ] **Step 2: Update Root.tsx — bump total duration to 2250 frames**

In `video/src/Root.tsx`, change:
```tsx
durationInFrames={1950}
```
to:
```tsx
durationInFrames={2250}
```

- [ ] **Step 3: Replace script.ts with v2 content**

Replace the entire contents of `video/src/data/script.ts` with:

```ts
// All demo text content for MEDERA promo v2

export const SCENE_CALLOUTS = {
  patientsTriaged: "PATIENTS TRIAGED IN SECONDS",
  aiPreVisitBrief: "AI-GENERATED PRE-VISIT BRIEF",
  aiThinks: "AI THAT THINKS WITH YOUR DOCTORS",
  mriSegmentation: "REAL-TIME BRAIN TUMOR SEGMENTATION",
  hospitalOps: "REAL-TIME HOSPITAL OPERATIONS",
  oneClickToStart: "ONE CLICK TO START",
} as const;

export const PROBLEM_LINES = [
  { text: "Patients wait. Paperwork piles up.", enterFrame: 15, exitFrame: 90, fontSize: 38, color: "#94a3b8" },
  { text: "Doctors juggle 5 apps to see one patient.", enterFrame: 50, exitFrame: 120, fontSize: 38, color: "#94a3b8" },
  { text: "There has to be a better way.", enterFrame: 100, exitFrame: 160, fontSize: 44, fontWeight: 700, color: "#ffffff" },
] as const;

export const BRAND_TAGLINE = "One AI Agent. The Entire Hospital Workflow.";

export const INTAKE_MESSAGES = [
  { role: "assistant" as const, text: "Hi! I'm your intake assistant. Are you a new or returning patient?" },
  { role: "user" as const, text: "I'm new. I have chest pain and shortness of breath." },
  { role: "assistant" as const, text: "I'm sorry to hear that. Let me get you checked in right away." },
] as const;

export const INTAKE_FORM = {
  title: "Quick Check-In",
  fields: [
    { label: "Full Name", value: "Sarah Chen", type: "text" as const },
    { label: "Date of Birth", value: "03/15/1985", type: "text" as const },
    { label: "Symptoms", value: "Chest pain, shortness of breath", type: "textarea" as const },
  ],
} as const;

export const TRIAGE_RESULT = {
  department: "Cardiology",
  urgency: "Urgent",
  urgencyColor: "#d97706",
  message: "A care team is being notified now",
  trackingId: "VIS-20260418-001",
} as const;

export const PATIENT_LIST = [
  { name: "Sarah Chen", urgency: "urgent" as const, urgencyColor: "#d97706", complaint: "Chest pain", waitMinutes: 3, selected: true },
  { name: "James Wilson", urgency: "routine" as const, urgencyColor: "#059669", complaint: "Follow-up visit", waitMinutes: 12 },
  { name: "Maria Garcia", urgency: "routine" as const, urgencyColor: "#059669", complaint: "Annual physical", waitMinutes: 18 },
] as const;

export const PATIENT_HEADER = {
  name: "Sarah Chen",
  age: 42,
  sex: "F",
  visitId: "VIS-20260418-001",
} as const;

export const PATIENT_VITALS = [
  { label: "BP", value: "128/82", unit: "mmHg" },
  { label: "HR", value: "92", unit: "bpm" },
  { label: "SpO₂", value: "98", unit: "%" },
  { label: "Temp", value: "37.1", unit: "°C" },
] as const;

export const VISIT_BRIEF =
  "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history.";

export const SUGGESTED_ORDERS = [
  { name: "Troponin I", badge: "Lab", badgeColor: "#6366f1" },
  { name: "12-Lead ECG", badge: "Lab", badgeColor: "#6366f1" },
  { name: "Chest X-Ray", badge: "Imaging", badgeColor: "#0891b2" },
] as const;

export const AI_DOCTOR_QUERY = "Review labs and recommend next steps for Sarah Chen";

export const AI_TOOL_CALLS = [
  { name: "search_patient_records" },
  { name: "check_drug_interactions" },
  { name: "analyze_lab_results" },
] as const;

export const AI_RESPONSE =
  "Based on elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy.";

export const MRI_COMMAND = "Perform MRI segmentation on Sarah Chen's brain scan";
export const MRI_PROCESSING_TEXT = "Analyzing 4 MRI modalities...";
export const MRI_PROCESSING_SUBTEXT = "T1 · T1ce · T2 · FLAIR";
export const MRI_METADATA = "Slice 78/155 · Tumor coverage: 12.4%";

export const MRI_LEGEND = [
  { color: "#dc2626", label: "Necrotic Core" },
  { color: "#22c55e", label: "Peritumoral Edema" },
  { color: "#3b82f6", label: "Enhancing Tumor" },
] as const;

export const KPI_METRICS = [
  { label: "Active Visits", value: 24 },
  { label: "Pending Review", value: 7 },
  { label: "Avg Wait Time", value: "8 min" },
  { label: "Admission Rate", value: "67%" },
] as const;

export const KANBAN_COLUMNS = [
  {
    title: "Intake",
    color: "#6366f1",
    cards: [
      { name: "D. Thompson", dept: "Neurology", wait: "2m" },
      { name: "L. Park", dept: "ENT", wait: "1m" },
    ],
  },
  {
    title: "Triaged",
    color: "#d97706",
    cards: [
      { name: "A. Foster", dept: "Cardiology", wait: "5m", movesOut: true as const },
      { name: "R. Patel", dept: "Radiology", wait: "8m" },
      { name: "K. Nguyen", dept: "Orthopedics", wait: "3m" },
    ],
  },
  {
    title: "In Department",
    color: "#0891b2",
    cards: [
      { name: "S. Chen", dept: "Cardiology", wait: "12m", highlight: true as const },
      { name: "J. Wilson", dept: "Internal Med", wait: "20m" },
      { name: "A. Foster", dept: "Cardiology", wait: "5m", movesIn: true as const },
    ],
  },
  {
    title: "Completed",
    color: "#059669",
    cards: [
      { name: "M. Garcia", dept: "General", wait: "—" },
      { name: "T. Brooks", dept: "Dermatology", wait: "—" },
    ],
  },
] as const;

export const CLOSING_TAGLINE = "INTELLIGENT HEALTHCARE, AUTOMATED.";
export const CLOSING_URL = "medera.ai";

export const FEATURE_RECAP = [
  { label: "Smart Intake" },
  { label: "Doctor Workspace" },
  { label: "AI Segmentation" },
  { label: "Admin Dashboard" },
] as const;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd video && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about missing scene imports in DemoVideo.tsx (not yet updated). No errors in Root.tsx or script.ts.

- [ ] **Step 5: Commit**

```bash
cd video && git add package.json package-lock.json src/Root.tsx src/data/script.ts && git commit -m "feat(video): setup v2 — lucide-react, 2250 frames, v2 script content"
```

---

## Task 2: ProblemTextSequence + ProcessingIndicator components

**Files:**
- Create: `video/src/components/problem-text-sequence.tsx`
- Create: `video/src/components/processing-indicator.tsx`

- [ ] **Step 1: Create problem-text-sequence.tsx**

Create `video/src/components/problem-text-sequence.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface ProblemLine {
  readonly text: string;
  readonly enterFrame: number;
  readonly exitFrame: number;
  readonly fontSize: number;
  readonly fontWeight?: number;
  readonly color: string;
}

interface ProblemTextSequenceProps {
  lines: readonly ProblemLine[];
}

export const ProblemTextSequence: React.FC<ProblemTextSequenceProps> = ({ lines }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center" }}>
      {lines.map((line, i) => {
        const opacity = interpolate(
          frame,
          [line.enterFrame, line.enterFrame + 20, line.exitFrame - 15, line.exitFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const translateY = interpolate(
          frame,
          [line.enterFrame, line.enterFrame + 20],
          [12, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              fontSize: line.fontSize,
              fontWeight: line.fontWeight ?? 400,
              color: line.color,
              textAlign: "center",
              fontFamily: fonts.body,
              maxWidth: 860,
              lineHeight: 1.35,
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Create processing-indicator.tsx**

Create `video/src/components/processing-indicator.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface ProcessingIndicatorProps {
  text: string;
  subtext?: string;
  color?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  text,
  subtext,
  color = "#0891b2",
}) => {
  const frame = useCurrentFrame();

  const dotOpacities = [0, 1, 2].map((i) => {
    const cycle = (frame + i * 8) % 24;
    return interpolate(cycle, [0, 8, 16, 24], [0.3, 1, 0.3, 0.3], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {dotOpacities.map((opacity, i) => (
          <div
            key={i}
            style={{ width: 10, height: 10, borderRadius: "50%", background: color, opacity }}
          />
        ))}
      </div>
      <div style={{ color: "#e2e8f0", fontSize: 16, fontFamily: fonts.display }}>{text}</div>
      {subtext && (
        <div style={{ color: "#64748b", fontSize: 13, fontFamily: fonts.display, letterSpacing: "0.1em" }}>
          {subtext}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep -E "problem-text|processing-indicator" | head -10
```

Expected: no output (no errors in the new files).

- [ ] **Step 4: Commit**

```bash
cd video && git add src/components/problem-text-sequence.tsx src/components/processing-indicator.tsx && git commit -m "feat(video): add ProblemTextSequence and ProcessingIndicator components"
```

---

## Task 3: KpiBar + SegmentationLegend + FeatureRecapRow components

**Files:**
- Create: `video/src/components/kpi-bar.tsx`
- Create: `video/src/components/segmentation-legend.tsx`
- Create: `video/src/components/feature-recap-row.tsx`

- [ ] **Step 1: Create kpi-bar.tsx**

Create `video/src/components/kpi-bar.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

interface KpiMetric {
  readonly label: string;
  readonly value: number | string;
}

interface KpiBarProps {
  metrics: readonly KpiMetric[];
  enterFrame?: number;
  countDuration?: number;
}

export const KpiBar: React.FC<KpiBarProps> = ({
  metrics,
  enterFrame = 0,
  countDuration = 30,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [enterFrame, enterFrame + 15], [-10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        gap: 0,
        background: colors.card,
        borderRadius: radius.xl,
        padding: "16px 0",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      }}
    >
      {metrics.map((m, i) => {
        let displayValue: string | number = m.value;
        if (typeof m.value === "number") {
          displayValue = Math.round(
            interpolate(Math.max(0, frame - enterFrame), [0, countDuration], [0, m.value], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          );
        }
        return (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              borderRight: i < metrics.length - 1 ? `1px solid ${colors.border}` : "none",
              padding: "0 32px",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: colors.foreground, fontFamily: fonts.display }}>
              {displayValue}
            </div>
            <div style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 4 }}>
              {m.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Create segmentation-legend.tsx**

Create `video/src/components/segmentation-legend.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface LegendItem {
  readonly color: string;
  readonly label: string;
}

interface SegmentationLegendProps {
  items: readonly LegendItem[];
  enterFrame?: number;
}

export const SegmentationLegend: React.FC<SegmentationLegendProps> = ({
  items,
  enterFrame = 0,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((item, i) => {
        const itemEnter = enterFrame + i * 10;
        const opacity = interpolate(frame, [itemEnter, itemEnter + 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateX = interpolate(frame, [itemEnter, itemEnter + 15], [-12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateX(${translateX}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: item.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#e2e8f0", fontSize: 14, fontFamily: fonts.display }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Create feature-recap-row.tsx**

Create `video/src/components/feature-recap-row.tsx`:

```tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Stethoscope, LayoutDashboard, Brain, BarChart2 } from "lucide-react";
import { fonts, colors } from "../styles/theme";

const RECAP_ICONS = [Stethoscope, LayoutDashboard, Brain, BarChart2] as const;

interface RecapItem {
  readonly label: string;
}

interface FeatureRecapRowProps {
  items: readonly RecapItem[];
  enterFrame?: number;
  exitFrame?: number;
}

export const FeatureRecapRow: React.FC<FeatureRecapRowProps> = ({
  items,
  enterFrame = 0,
  exitFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rowOpacity =
    exitFrame !== undefined
      ? interpolate(frame, [exitFrame - 15, exitFrame], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <div
      style={{
        display: "flex",
        gap: 64,
        alignItems: "center",
        justifyContent: "center",
        opacity: rowOpacity,
      }}
    >
      {items.map((item, i) => {
        const Icon = RECAP_ICONS[i % RECAP_ICONS.length];
        const itemEnter = enterFrame + i * 10;
        const progress = spring({
          frame: Math.max(0, frame - itemEnter),
          fps,
          config: { damping: 20, mass: 1.2 },
        });
        const opacity = interpolate(progress, [0, 0.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `scale(${progress})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(8,145,178,0.1)",
                border: "1px solid rgba(8,145,178,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={28} color={colors.cyan} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: 14,
                color: colors.foreground,
                fontFamily: fonts.body,
                fontWeight: 500,
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep -E "kpi-bar|segmentation-legend|feature-recap" | head -10
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd video && git add src/components/kpi-bar.tsx src/components/segmentation-legend.tsx src/components/feature-recap-row.tsx && git commit -m "feat(video): add KpiBar, SegmentationLegend, FeatureRecapRow components"
```

---

## Task 4: MriVisualization component

**Files:**
- Create: `video/src/components/mri-visualization.tsx`

The "brain slice" is rendered as an SVG using ellipses and gradient fills. Segmentation layers use SVG `clipPath` circles that grow over time (paintOnFromCenter effect).

- [ ] **Step 1: Create mri-visualization.tsx**

Create `video/src/components/mri-visualization.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface MriVisualizationProps {
  baseEnterFrame?: number;
  overlayEnterFrame?: number;
  metadataEnterFrame?: number;
  metadataText?: string;
}

export const MriVisualization: React.FC<MriVisualizationProps> = ({
  baseEnterFrame = 0,
  overlayEnterFrame = 30,
  metadataEnterFrame = 130,
  metadataText = "Slice 78/155 · Tumor coverage: 12.4%",
}) => {
  const frame = useCurrentFrame();

  const baseOpacity = interpolate(frame, [baseEnterFrame, baseEnterFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Each overlay layer grows via expanding clip circle
  const layerProgress = (delayFrames: number) =>
    interpolate(
      frame,
      [overlayEnterFrame + delayFrames, overlayEnterFrame + delayFrames + 45],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const clip0R = layerProgress(0) * 320;   // Necrotic Core
  const clip1R = layerProgress(20) * 320;  // Peritumoral Edema
  const clip2R = layerProgress(40) * 320;  // Enhancing Tumor

  const metaOpacity = interpolate(frame, [metadataEnterFrame, metadataEnterFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 420, height: 420, opacity: baseOpacity }}>
        <svg
          width={420}
          height={420}
          viewBox="0 0 420 420"
          style={{ borderRadius: 12, overflow: "hidden" }}
        >
          <defs>
            <radialGradient id="brainBase" cx="50%" cy="44%" r="50%">
              <stop offset="0%" stopColor="#3a3a50" />
              <stop offset="45%" stopColor="#252535" />
              <stop offset="75%" stopColor="#181828" />
              <stop offset="100%" stopColor="#0a0e17" />
            </radialGradient>
            <clipPath id="mriClip0">
              <circle cx="210" cy="200" r={clip0R} />
            </clipPath>
            <clipPath id="mriClip1">
              <circle cx="210" cy="200" r={clip1R} />
            </clipPath>
            <clipPath id="mriClip2">
              <circle cx="210" cy="200" r={clip2R} />
            </clipPath>
          </defs>

          {/* Dark brain background */}
          <rect width={420} height={420} fill="url(#brainBase)" rx={12} />

          {/* Skull/brain outline */}
          <ellipse cx={210} cy={210} rx={185} ry={200} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* Cortical surface rings */}
          <ellipse cx={210} cy={205} rx={148} ry={163} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={7} />
          <ellipse cx={210} cy={203} rx={110} ry={125} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={5} />
          <ellipse cx={210} cy={200} rx={72} ry={85} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={4} />

          {/* Central sulcus / fissure lines */}
          <path d="M210 22 Q198 110 210 210" stroke="rgba(0,0,0,0.35)" strokeWidth={2} fill="none" />
          <path d="M125 85 Q155 160 135 230" stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} fill="none" />
          <path d="M295 85 Q265 160 285 230" stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} fill="none" />
          <path d="M80 200 Q160 185 210 210" stroke="rgba(0,0,0,0.15)" strokeWidth={1} fill="none" />

          {/* Peritumoral Edema — largest, renders below enhancing tumor */}
          <ellipse
            cx={218} cy={203} rx={98} ry={88}
            fill="#22c55e"
            fillOpacity={0.4}
            clipPath="url(#mriClip1)"
          />
          {/* Enhancing Tumor ring */}
          <ellipse
            cx={210} cy={197} rx={72} ry={65}
            fill="#3b82f6"
            fillOpacity={0.5}
            clipPath="url(#mriClip2)"
          />
          {/* Necrotic Core — smallest, on top */}
          <ellipse
            cx={210} cy={197} rx={46} ry={40}
            fill="#dc2626"
            fillOpacity={0.65}
            clipPath="url(#mriClip0)"
          />

          {/* Outer frame */}
          <rect
            width={420}
            height={420}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
            rx={12}
          />
        </svg>
      </div>

      {/* Metadata line */}
      <div
        style={{
          opacity: metaOpacity,
          fontSize: 13,
          color: "#94a3b8",
          fontFamily: fonts.display,
          letterSpacing: "0.06em",
        }}
      >
        {metadataText}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "mri-visualization" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/components/mri-visualization.tsx && git commit -m "feat(video): add MriVisualization component with animated segmentation overlays"
```

---

## Task 5: KanbanBoard component

**Files:**
- Create: `video/src/components/kanban-board.tsx`

Live card move: cards flagged `movesOut` fade out at `moveStartFrame`; cards flagged `movesIn` fade in at `moveStartFrame`. This gives the visual effect of a card moving between columns without requiring absolute-positioned cross-column animation.

- [ ] **Step 1: Create kanban-board.tsx**

Create `video/src/components/kanban-board.tsx`:

```tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

interface KanbanCardData {
  readonly name: string;
  readonly dept: string;
  readonly wait: string;
  readonly highlight?: boolean;
  readonly movesOut?: true;
  readonly movesIn?: true;
}

interface KanbanColumnData {
  readonly title: string;
  readonly color: string;
  readonly cards: readonly KanbanCardData[];
}

interface KanbanBoardProps {
  columns: readonly KanbanColumnData[];
  enterFrame?: number;
  moveStartFrame?: number;
  moveDuration?: number;
}

const KanbanCard: React.FC<{
  card: KanbanCardData;
  enterFrame: number;
  moveStartFrame: number;
  moveDuration: number;
}> = ({ card, enterFrame, moveStartFrame, moveDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 18, mass: 1 },
  });

  const entryOpacity = interpolate(entryProgress, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const moveOutOpacity = card.movesOut
    ? interpolate(frame, [moveStartFrame, moveStartFrame + 15], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const moveInOpacity = card.movesIn
    ? interpolate(frame, [moveStartFrame + 10, moveStartFrame + moveDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const finalOpacity = entryOpacity * moveOutOpacity * moveInOpacity;
  const translateY = interpolate(entryProgress, [0, 1], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: finalOpacity,
        transform: `translateY(${translateY}px)`,
        background: card.highlight ? "rgba(8,145,178,0.07)" : colors.card,
        border: `1px solid ${card.highlight ? "rgba(8,145,178,0.3)" : colors.border}`,
        borderRadius: radius.md,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
        {card.name}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body }}>
          {card.dept}
        </span>
        <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.display }}>
          {card.wait}
        </span>
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  enterFrame = 0,
  moveStartFrame = 170,
  moveDuration = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", gap: 12, width: "100%" }}>
      {columns.map((col, ci) => {
        const colEnter = enterFrame + ci * 8;
        const colProgress = spring({
          frame: Math.max(0, frame - colEnter),
          fps,
          config: { damping: 20, mass: 1.2 },
        });
        const colOpacity = interpolate(colProgress, [0, 0.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const colY = interpolate(colProgress, [0, 1], [18, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={ci}
            style={{
              flex: 1,
              opacity: colOpacity,
              transform: `translateY(${colY}px)`,
              background: "#f1f3f5",
              borderRadius: radius.xl,
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: col.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: col.color,
                  fontFamily: fonts.display,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {col.title}
              </span>
            </div>

            {col.cards.map((card, ki) => (
              <KanbanCard
                key={ki}
                card={card}
                enterFrame={colEnter + 12 + ki * 6}
                moveStartFrame={moveStartFrame}
                moveDuration={moveDuration}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "kanban-board" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/components/kanban-board.tsx && git commit -m "feat(video): add KanbanBoard component with live card move animation"
```

---

## Task 6: ProblemHook scene

**Files:**
- Create: `video/src/scenes/problem-hook.tsx`

Duration: 180 frames. Dark background, ECG pulse wave, three sequential text lines, fade-to-white at the end.

- [ ] **Step 1: Create problem-hook.tsx**

Create `video/src/scenes/problem-hook.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "../components/particle-network";
import { PulseWave } from "../components/pulse-wave";
import { ProblemTextSequence } from "../components/problem-text-sequence";
import { PROBLEM_LINES } from "../data/script";

export const ProblemHook: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeToWhite = interpolate(frame, [155, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#0a0e17",
      }}
    >
      {/* Subtle background b-roll */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
        <ParticleNetwork opacity={1} fadeInFrames={30} />
        <PulseWave y={900} opacity={0.3} speed={3} />
      </div>

      {/* Centered text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <ProblemTextSequence lines={PROBLEM_LINES} />
      </div>

      {/* Fade-to-white transition overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          opacity: fadeToWhite,
          zIndex: 10,
        }}
      />
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "problem-hook" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/problem-hook.tsx && git commit -m "feat(video): add ProblemHook scene"
```

---

## Task 7: BrandReveal scene

**Files:**
- Create: `video/src/scenes/brand-reveal.tsx`

Duration: 210 frames. Dark-to-light gradient. Logo particle assembly (f0), tagline typewriter (f85), four feature icons (f140).

- [ ] **Step 1: Create brand-reveal.tsx**

Create `video/src/scenes/brand-reveal.tsx`:

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Network, Brain, Stethoscope, Scan } from "lucide-react";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { ParticleNetwork } from "../components/particle-network";
import { DnaHelix } from "../components/dna-helix";
import { BRAND_TAGLINE } from "../data/script";
import { colors, fonts } from "../styles/theme";

const FEATURE_ICONS = [
  { Icon: Stethoscope, label: "Screen" },
  { Icon: Network, label: "Route" },
  { Icon: Brain, label: "Assist" },
  { Icon: Scan, label: "Analyze" },
] as const;

export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background transitions from dark to light over first 100 frames
  const bgLightness = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Interpolate background color: #0a0e17 → #f8f9fb
  const bgR = Math.round(interpolate(bgLightness, [0, 1], [10, 248]));
  const bgG = Math.round(interpolate(bgLightness, [0, 1], [14, 249]));
  const bgB = Math.round(interpolate(bgLightness, [0, 1], [23, 251]));

  // Fade out at end
  const fadeOut = interpolate(frame, [190, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: `rgb(${bgR},${bgG},${bgB})`,
      }}
    >
      {/* B-roll elements */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(frame, [0, 50, 100], [0.2, 0.3, 0.35], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <ParticleNetwork opacity={1} fadeInFrames={30} />
        <DnaHelix x={1600} y={150} height={400} opacity={0.25} />
        <DnaHelix x={200} y={500} height={300} opacity={0.15} />
      </div>

      {/* Content column */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          zIndex: 1,
        }}
      >
        <LogoAssembly startFrame={0} />

        {/* Tagline */}
        {frame >= 85 && (
          <div>
            <Typewriter
              text={BRAND_TAGLINE}
              startFrame={85}
              charsPerFrame={2.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 36,
                fontWeight: 700,
                background: "linear-gradient(to right, #0891b2, #0d9488)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            />
          </div>
        )}

        {/* Feature icons row */}
        {frame >= 140 && (
          <div style={{ display: "flex", gap: 80, alignItems: "center", marginTop: 8 }}>
            {FEATURE_ICONS.map(({ Icon, label }, i) => {
              const iconEnter = 140 + i * 12;
              const progress = spring({
                frame: Math.max(0, frame - iconEnter),
                fps,
                config: { damping: 20, mass: 1.2 },
              });
              const opacity = interpolate(progress, [0, 0.5], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    opacity,
                    transform: `scale(${progress})`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: "rgba(8,145,178,0.1)",
                      border: "1px solid rgba(8,145,178,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={26} color={colors.cyan} strokeWidth={1.5} />
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: colors.mutedForeground,
                      fontFamily: fonts.body,
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fade-out overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#f8f9fb",
          opacity: fadeOut,
          zIndex: 10,
        }}
      />
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "brand-reveal" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/brand-reveal.tsx && git commit -m "feat(video): add BrandReveal scene"
```

---

## Task 8: SmartIntake scene

**Files:**
- Create: `video/src/scenes/smart-intake.tsx`

Duration: 450 frames. Chat inside IphoneFrame, then intake form, submit button, triage result card. Content scrolls down by shifting a wrapper's translateY. The iPhone is centered on the canvas.

- [ ] **Step 1: Create smart-intake.tsx**

Create `video/src/scenes/smart-intake.tsx`:

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { FeatureCallout } from "../components/feature-callout";
import { IphoneFrame } from "../components/iphone-frame";
import { MessageBubble } from "../components/message-bubble";
import { Typewriter } from "../components/typewriter";
import { FadeSlide } from "../components/fade-slide";
import {
  SCENE_CALLOUTS,
  INTAKE_MESSAGES,
  INTAKE_FORM,
  TRIAGE_RESULT,
} from "../data/script";
import { colors, fonts, radius } from "../styles/theme";

/* Simulates auto-typing into a field */
const AutoField: React.FC<{
  label: string;
  value: string;
  startFrame: number;
  fieldType?: "text" | "textarea";
}> = ({ label, value, startFrame, fieldType = "text" }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const charsPerFrame = fieldType === "textarea" ? 1.5 : 2;
  const elapsed = frame - startFrame;
  const visible = Math.min(value.length, Math.floor(elapsed * charsPerFrame));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, fontWeight: 500 }}>
        {label}
      </label>
      <div
        style={{
          background: "#f8f9fb",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: fieldType === "textarea" ? "8px 10px" : "7px 10px",
          fontSize: 13,
          color: colors.foreground,
          fontFamily: fonts.body,
          minHeight: fieldType === "textarea" ? 44 : "auto",
        }}
      >
        {value.slice(0, visible)}
        {visible < value.length && elapsed > 0 && (
          <span style={{ opacity: Math.round((frame % 16) / 8) ? 1 : 0.3 }}>|</span>
        )}
      </div>
    </div>
  );
};

export const SmartIntake: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera scroll: push content up as conversation grows
  const scrollY = interpolate(
    frame,
    [0, 80, 180, 310, 340],
    [0, 0, -180, -330, -430],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Submit button click pulse
  const submitScale = frame >= 310
    ? spring({ frame: frame - 310, fps, config: { damping: 12, mass: 0.8 } })
    : 0;

  // Triage card bounce-in
  const triageProgress = frame >= 340
    ? spring({ frame: frame - 340, fps, config: { damping: 14, mass: 0.9 } })
    : 0;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />

      <FeatureCallout
        text={SCENE_CALLOUTS.patientsTriaged}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      {/* iPhone centered on canvas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <IphoneFrame width={400} enterFrame={0} enterFrom="bottom">
          {/* Scrollable content inside phone */}
          <div
            style={{
              transform: `translateY(${scrollY}px)`,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition: "none",
            }}
          >
            {/* Chat messages */}
            <MessageBubble
              role="assistant"
              text={INTAKE_MESSAGES[0].text}
              startFrame={20}
              typewriter
              charsPerFrame={3}
              fontSize={14}
            />
            <MessageBubble
              role="user"
              text={INTAKE_MESSAGES[1].text}
              startFrame={80}
              fontSize={14}
            />
            <MessageBubble
              role="assistant"
              text={INTAKE_MESSAGES[2].text}
              startFrame={120}
              typewriter
              charsPerFrame={2.5}
              fontSize={14}
            />

            {/* Intake form */}
            {frame >= 180 && (
              <FadeSlide startFrame={180} direction="up" distance={20}>
                <div
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                    {INTAKE_FORM.title}
                  </div>
                  {INTAKE_FORM.fields.map((field, i) => (
                    <AutoField
                      key={i}
                      label={field.label}
                      value={field.value}
                      startFrame={200 + i * 20}
                      fieldType={field.type}
                    />
                  ))}
                </div>
              </FadeSlide>
            )}

            {/* Submit button */}
            {frame >= 310 && (
              <div
                style={{
                  transform: `scale(${0.8 + submitScale * 0.2})`,
                  opacity: 0.2 + submitScale * 0.8,
                  background: "linear-gradient(to right, #0891b2, #0d9488)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fonts.body,
                  textAlign: "center",
                  padding: "12px 0",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Submit →
              </div>
            )}

            {/* Triage result card */}
            {frame >= 340 && (
              <div
                style={{
                  transform: `scale(${triageProgress})`,
                  opacity: interpolate(triageProgress, [0, 0.5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  background: "#f0fdf4",
                  border: "1px solid #059669",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#166534", fontFamily: fonts.body }}>
                    {TRIAGE_RESULT.department}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: TRIAGE_RESULT.urgencyColor,
                      fontFamily: fonts.display,
                      background: "rgba(217,119,6,0.08)",
                      padding: "2px 7px",
                      borderRadius: 4,
                    }}
                  >
                    {TRIAGE_RESULT.urgency}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#166534", fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.message}
                </div>
                <div style={{ fontSize: 10, color: "#4ade80", fontFamily: fonts.display, letterSpacing: "0.05em" }}>
                  {TRIAGE_RESULT.trackingId}
                </div>
              </div>
            )}
          </div>
        </IphoneFrame>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "smart-intake" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/smart-intake.tsx && git commit -m "feat(video): add SmartIntake scene with IphoneFrame viewport"
```

---

## Task 9: DoctorWorkspace scene

**Files:**
- Create: `video/src/scenes/doctor-workspace.tsx`

Duration: 510 frames. Three-panel layout (left/center/right) inside a FloatingScreen. Implemented as 3 sequential beats using opacity-based panel focus (left panels at 40% opacity when off-focus). Beat timing: Beat1 f0–150, Beat2 f150–310, Beat3 f310–510.

- [ ] **Step 1: Create doctor-workspace.tsx**

Create `video/src/scenes/doctor-workspace.tsx`:

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { FloatingScreen } from "../components/floating-screen";
import { FeatureCallout } from "../components/feature-callout";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import {
  SCENE_CALLOUTS,
  PATIENT_LIST,
  PATIENT_HEADER,
  PATIENT_VITALS,
  VISIT_BRIEF,
  SUGGESTED_ORDERS,
  AI_DOCTOR_QUERY,
  AI_TOOL_CALLS,
  AI_RESPONSE,
} from "../data/script";
import { colors, fonts, radius } from "../styles/theme";

/* ── Left panel: patient queue ──────────────────────────────── */
const PatientQueue: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cursor click animation on "Accept Patient" button at f100
  const clickProgress = frame >= 100
    ? spring({ frame: frame - 100, fps, config: { damping: 12, mass: 0.8 } })
    : 0;

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 8, height: "100%", padding: "12px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        Patient Queue
      </div>

      {PATIENT_LIST.map((patient, i) => {
        const enterProgress = spring({
          frame: Math.max(0, frame - (15 + i * 8)),
          fps,
          config: { damping: 18, mass: 1 },
        });
        const entryOpacity = interpolate(enterProgress, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const translateX = interpolate(enterProgress, [0, 1], [-12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        const isSelected = patient.selected;
        const selectedGlow = isSelected && frame >= 100
          ? interpolate(frame, [100, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;

        return (
          <div
            key={i}
            style={{
              opacity: entryOpacity,
              transform: `translateX(${translateX}px)`,
              background: isSelected ? `rgba(8,145,178,${0.04 + selectedGlow * 0.08})` : colors.card,
              border: `1px solid ${isSelected ? `rgba(8,145,178,${0.15 + selectedGlow * 0.2})` : colors.border}`,
              borderRadius: radius.md,
              padding: "8px 10px",
              boxShadow: isSelected && selectedGlow > 0.5 ? `0 0 0 2px rgba(8,145,178,${selectedGlow * 0.25})` : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                {patient.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: patient.urgencyColor,
                  fontFamily: fonts.display,
                  background: `${patient.urgencyColor}18`,
                  padding: "1px 6px",
                  borderRadius: 3,
                }}
              >
                {patient.urgency}
              </span>
            </div>
            <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 2 }}>
              {patient.complaint} · {patient.waitMinutes}m wait
            </div>
          </div>
        );
      })}

      {/* Accept Patient button */}
      {frame >= 80 && (
        <div
          style={{
            marginTop: "auto",
            transform: `scale(${0.95 + clickProgress * 0.05})`,
            background: "linear-gradient(to right, #0891b2, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fonts.body,
            textAlign: "center",
            padding: "10px 0",
            borderRadius: radius.md,
            opacity: interpolate(frame, [80, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Accept Patient
        </div>
      )}
    </div>
  );
};

/* ── Center panel: clinical workspace ──────────────────────── */
const ClinicalWorkspace: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 10, height: "100%", padding: "12px 10px", overflowY: "hidden" }}>
      {/* Patient header */}
      {frame >= 170 && (
        <FadeSlide startFrame={170} direction="up" distance={12}>
          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.foreground, fontFamily: fonts.body }}>
                {PATIENT_HEADER.name}
              </div>
              <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 2 }}>
                {PATIENT_HEADER.age}y · {PATIENT_HEADER.sex} · {PATIENT_HEADER.visitId}
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: colors.cyan,
                fontFamily: fonts.display,
                background: "rgba(8,145,178,0.08)",
                padding: "3px 8px",
                borderRadius: 4,
                letterSpacing: "0.05em",
              }}
            >
              ACTIVE
            </div>
          </div>
        </FadeSlide>
      )}

      {/* Vitals row */}
      {frame >= 185 && (
        <div style={{ display: "flex", gap: 6 }}>
          {PATIENT_VITALS.map((v, i) => {
            const vEnter = 185 + i * 10;
            const vOpacity = interpolate(frame, [vEnter, vEnter + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  opacity: vOpacity,
                  background: "#f8f9fb",
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.display }}>{v.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.foreground, fontFamily: fonts.display, marginTop: 2 }}>
                  {v.value}
                </div>
                <div style={{ fontSize: 9, color: colors.mutedForeground, fontFamily: fonts.body }}>{v.unit}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pre-visit brief */}
      {frame >= 210 && (
        <div
          style={{
            background: "#f0f9ff",
            borderLeft: "3px solid #0891b2",
            borderRadius: `0 ${radius.md}px ${radius.md}px 0`,
            padding: "10px 12px",
            fontSize: 12,
            color: colors.foreground,
            fontFamily: fonts.body,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.cyan, fontFamily: fonts.display, letterSpacing: "0.08em", marginBottom: 6 }}>
            AI PRE-VISIT BRIEF
          </div>
          <Typewriter text={VISIT_BRIEF} startFrame={215} charsPerFrame={2} />
        </div>
      )}

      {/* Suggested orders */}
      {frame >= 270 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Suggested Orders
          </div>
          {SUGGESTED_ORDERS.map((order, i) => {
            const oEnter = 270 + i * 8;
            const oOpacity = interpolate(frame, [oEnter, oEnter + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const oY = interpolate(frame, [oEnter, oEnter + 12], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  opacity: oOpacity,
                  transform: `translateY(${oY}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "7px 10px",
                }}
              >
                <span style={{ fontSize: 12, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: order.badgeColor,
                    background: `${order.badgeColor}15`,
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontFamily: fonts.display,
                  }}
                >
                  {order.badge}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Right panel: AI assistant ──────────────────────────────── */
const AiAssistant: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tool call status: each tool goes running → done
  const getToolStatus = (i: number): "idle" | "running" | "done" => {
    const runStart = 360 + i * 15;
    const doneStart = runStart + 20;
    if (frame >= doneStart) return "done";
    if (frame >= runStart) return "running";
    return "idle";
  };

  // "Place Order" button pulse
  const btnProgress = frame >= 475
    ? spring({ frame: frame - 475, fps, config: { damping: 14, mass: 0.9 } })
    : 0;

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 8, height: "100%", padding: "12px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        AI Assistant
      </div>

      {/* Doctor query */}
      {frame >= 330 && (
        <FadeSlide startFrame={330} direction="right" distance={16}>
          <div
            style={{
              background: "rgba(8,145,178,0.07)",
              border: "1px solid rgba(8,145,178,0.15)",
              borderRadius: radius.md,
              padding: "8px 12px",
              fontSize: 12,
              color: colors.foreground,
              fontFamily: fonts.body,
              lineHeight: 1.4,
            }}
          >
            {AI_DOCTOR_QUERY}
          </div>
        </FadeSlide>
      )}

      {/* Tool calls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {AI_TOOL_CALLS.map((tool, i) => {
          const status = getToolStatus(i);
          const toolEnter = 360 + i * 15;
          const toolOpacity = interpolate(frame, [toolEnter, toolEnter + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (status === "idle") return null;
          return (
            <div
              key={i}
              style={{
                opacity: toolOpacity,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f8f9fb",
                border: `1px solid ${colors.border}`,
                borderRadius: radius.sm,
                padding: "6px 8px",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: status === "done" ? "#059669" : "#d97706",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.display }}>{tool.name}</span>
              <span
                style={{
                  fontSize: 10,
                  color: status === "done" ? "#059669" : "#d97706",
                  fontFamily: fonts.display,
                  marginLeft: "auto",
                }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>

      {/* AI response */}
      {frame >= 425 && (
        <div
          style={{
            background: "#f8f9fb",
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: "10px 12px",
            fontSize: 12,
            color: colors.foreground,
            fontFamily: fonts.body,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.cyan, fontFamily: fonts.display, letterSpacing: "0.06em", marginBottom: 6 }}>
            MEDERA AI
          </div>
          <Typewriter text={AI_RESPONSE} startFrame={430} charsPerFrame={2} />
        </div>
      )}

      {/* Place Order CTA */}
      {frame >= 475 && (
        <div
          style={{
            marginTop: "auto",
            transform: `scale(${0.9 + btnProgress * 0.1})`,
            opacity: interpolate(btnProgress, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            background: "linear-gradient(to right, #0891b2, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fonts.body,
            textAlign: "center",
            padding: "10px 0",
            borderRadius: radius.md,
            boxShadow: `0 0 ${btnProgress * 12}px rgba(8,145,178,${btnProgress * 0.3})`,
          }}
        >
          + Place Order
        </div>
      )}
    </div>
  );
};

/* ── Main scene ─────────────────────────────────────────────── */
export const DoctorWorkspace: React.FC = () => {
  const frame = useCurrentFrame();

  // Panel focus opacity: off-focus panels dim to 40%
  const beat1 = interpolate(frame, [130, 160], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat2Focus = interpolate(frame, [150, 170], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat2Defocus = interpolate(frame, [290, 315], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat3 = interpolate(frame, [310, 335], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const leftOpacity = Math.min(beat1, 1);
  const centerOpacity = Math.min(beat2Focus, beat2Defocus);
  const rightOpacity = beat3;

  // Callouts per beat
  const calloutText =
    frame < 150 ? SCENE_CALLOUTS.oneClickToStart
    : frame < 310 ? SCENE_CALLOUTS.aiPreVisitBrief
    : SCENE_CALLOUTS.aiThinks;

  const calloutKey = frame < 150 ? 0 : frame < 310 ? 1 : 2;
  const calloutStartFrame = [0, 155, 315][calloutKey];

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#f8f9fb",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />

      <FeatureCallout
        text={calloutText}
        position="top-center"
        startFrame={calloutStartFrame}
        endFrame={calloutStartFrame + 40}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <FloatingScreen enterFrame={0} widthPercent={82} variant="desktop">
          <div style={{ display: "flex", height: "100%", gap: 0 }}>
            {/* Left: 24% */}
            <div
              style={{
                width: "24%",
                borderRight: `1px solid ${colors.border}`,
                height: "100%",
              }}
            >
              <PatientQueue panelOpacity={leftOpacity} />
            </div>
            {/* Center: 44% */}
            <div
              style={{
                width: "44%",
                borderRight: `1px solid ${colors.border}`,
                height: "100%",
              }}
            >
              <ClinicalWorkspace panelOpacity={centerOpacity} />
            </div>
            {/* Right: 32% */}
            <div style={{ width: "32%", height: "100%" }}>
              <AiAssistant panelOpacity={rightOpacity} />
            </div>
          </div>
        </FloatingScreen>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "doctor-workspace" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/doctor-workspace.tsx && git commit -m "feat(video): add DoctorWorkspace scene with 3-beat panel focus"
```

---

## Task 10: MriSegmentation scene

**Files:**
- Create: `video/src/scenes/mri-segmentation.tsx`

Duration: 330 frames. Dark background. Doctor command (f20), processing indicator (f80–130), MRI visualization with overlays (f130), legend (f240), metadata (f260).

- [ ] **Step 1: Create mri-segmentation.tsx**

Create `video/src/scenes/mri-segmentation.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "../components/particle-network";
import { FeatureCallout } from "../components/feature-callout";
import { Typewriter } from "../components/typewriter";
import { ProcessingIndicator } from "../components/processing-indicator";
import { MriVisualization } from "../components/mri-visualization";
import { SegmentationLegend } from "../components/segmentation-legend";
import {
  SCENE_CALLOUTS,
  MRI_COMMAND,
  MRI_PROCESSING_TEXT,
  MRI_PROCESSING_SUBTEXT,
  MRI_METADATA,
  MRI_LEGEND,
} from "../data/script";
import { fonts } from "../styles/theme";

export const MriSegmentation: React.FC = () => {
  const frame = useCurrentFrame();

  const processingOpacity = interpolate(frame, [80, 90, 120, 130], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vizOpacity = interpolate(frame, [128, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#0a0e17",
      }}
    >
      {/* Subtle particle bg */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.12 }}>
        <ParticleNetwork opacity={1} fadeInFrames={30} />
      </div>

      <FeatureCallout
        text={SCENE_CALLOUTS.mriSegmentation}
        position="top-center"
        startFrame={10}
        endFrame={55}
      />

      {/* Doctor command */}
      {frame >= 20 && (
        <div
          style={{
            position: "absolute",
            top: 120,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px 24px",
            zIndex: 2,
          }}
        >
          <Typewriter
            text={MRI_COMMAND}
            startFrame={20}
            charsPerFrame={2.5}
            style={{
              color: "#e2e8f0",
              fontSize: 16,
              fontFamily: fonts.body,
              whiteSpace: "nowrap",
            }}
          />
        </div>
      )}

      {/* Processing indicator */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: processingOpacity,
          zIndex: 2,
        }}
      >
        <ProcessingIndicator
          text={MRI_PROCESSING_TEXT}
          subtext={MRI_PROCESSING_SUBTEXT}
          color="#0891b2"
        />
      </div>

      {/* MRI visualization + legend */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -44%)",
          opacity: vizOpacity,
          display: "flex",
          alignItems: "flex-start",
          gap: 48,
          zIndex: 2,
        }}
      >
        <MriVisualization
          baseEnterFrame={0}
          overlayEnterFrame={30}
          metadataEnterFrame={130}
          metadataText={MRI_METADATA}
        />
        <SegmentationLegend items={MRI_LEGEND} enterFrame={110} />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "mri-segmentation" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/mri-segmentation.tsx && git commit -m "feat(video): add MriSegmentation scene"
```

---

## Task 11: AdminDashboard scene

**Files:**
- Create: `video/src/scenes/admin-dashboard.tsx`

Duration: 270 frames. Light bg. KPI bar (f20), Kanban board (f60), live card move at f170.

- [ ] **Step 1: Create admin-dashboard.tsx**

Create `video/src/scenes/admin-dashboard.tsx`:

```tsx
import { useCurrentFrame } from "remotion";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { FeatureCallout } from "../components/feature-callout";
import { FloatingScreen } from "../components/floating-screen";
import { KpiBar } from "../components/kpi-bar";
import { KanbanBoard } from "../components/kanban-board";
import { SCENE_CALLOUTS, KPI_METRICS, KANBAN_COLUMNS } from "../data/script";

export const AdminDashboard: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#f8f9fb",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />

      <FeatureCallout
        text={SCENE_CALLOUTS.hospitalOps}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <FloatingScreen enterFrame={0} widthPercent={84} variant="desktop">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: 24,
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            <KpiBar metrics={KPI_METRICS} enterFrame={20} countDuration={30} />
            <KanbanBoard
              columns={KANBAN_COLUMNS}
              enterFrame={60}
              moveStartFrame={170}
              moveDuration={30}
            />
          </div>
        </FloatingScreen>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "admin-dashboard" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/admin-dashboard.tsx && git commit -m "feat(video): add AdminDashboard scene"
```

---

## Task 12: ClosingCta scene

**Files:**
- Create: `video/src/scenes/closing-cta.tsx` (replaces old file)

Duration: 300 frames. Light-to-dark gradient. Feature recap row exits at f120, logo re-assembles from f100, tagline typewriter at f160, URL at f220.

- [ ] **Step 1: Create closing-cta.tsx**

Create `video/src/scenes/closing-cta.tsx` (overwrite existing file):

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "../components/particle-network";
import { DnaHelix } from "../components/dna-helix";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { FeatureRecapRow } from "../components/feature-recap-row";
import { FEATURE_RECAP, CLOSING_TAGLINE, CLOSING_URL } from "../data/script";
import { fonts } from "../styles/theme";

export const ClosingCta: React.FC = () => {
  const frame = useCurrentFrame();

  // Light (#f8f9fb) to dark (#0a0e17) transition after f100
  const darkness = interpolate(frame, [80, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgR = Math.round(interpolate(darkness, [0, 1], [248, 10]));
  const bgG = Math.round(interpolate(darkness, [0, 1], [249, 14]));
  const bgB = Math.round(interpolate(darkness, [0, 1], [251, 23]));

  const urlOpacity = interpolate(frame, [220, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: `rgb(${bgR},${bgG},${bgB})`,
      }}
    >
      {/* B-roll builds up with darkness */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(darkness, [0, 1], [0.2, 0.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <ParticleNetwork opacity={1} fadeInFrames={30} />
        <DnaHelix x={1600} y={150} height={400} opacity={0.25} />
        <DnaHelix x={200} y={500} height={300} opacity={0.15} />
      </div>

      {/* Content column */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          zIndex: 1,
        }}
      >
        {/* Feature recap row — exits at f120 */}
        {frame < 130 && (
          <FeatureRecapRow items={FEATURE_RECAP} enterFrame={15} exitFrame={120} />
        )}

        {/* Logo reassembly */}
        {frame >= 100 && (
          <LogoAssembly startFrame={100} />
        )}

        {/* Closing tagline */}
        {frame >= 160 && (
          <Typewriter
            text={CLOSING_TAGLINE}
            startFrame={160}
            charsPerFrame={2}
            style={{
              fontFamily: fonts.display,
              fontSize: 40,
              fontWeight: 700,
              background: "linear-gradient(to right, #0891b2, #0d9488)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.05em",
            }}
          />
        )}

        {/* URL */}
        <div
          style={{
            opacity: urlOpacity,
            fontSize: 24,
            color: "#94a3b8",
            fontFamily: fonts.body,
          }}
        >
          {CLOSING_URL}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**

```bash
cd video && npx tsc --noEmit 2>&1 | grep "closing-cta" | head -10
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd video && git add src/scenes/closing-cta.tsx && git commit -m "feat(video): add ClosingCta scene with light-to-dark transition"
```

---

## Task 13: Wire DemoVideo.tsx, delete old scenes, full TypeScript verification

**Files:**
- Modify: `video/src/DemoVideo.tsx`
- Delete: `video/src/scenes/logo-reveal.tsx`, `video/src/scenes/agent-intro.tsx`, `video/src/scenes/patient-screening.tsx`, `video/src/scenes/routing-and-support.tsx`, `video/src/scenes/agent-advantages.tsx`

- [ ] **Step 1: Replace DemoVideo.tsx**

Replace the entire contents of `video/src/DemoVideo.tsx`:

```tsx
import { Series } from "remotion";
import { BRollLayer } from "./components/b-roll-layer";
import { ProblemHook } from "./scenes/problem-hook";
import { BrandReveal } from "./scenes/brand-reveal";
import { SmartIntake } from "./scenes/smart-intake";
import { DoctorWorkspace } from "./scenes/doctor-workspace";
import { MriSegmentation } from "./scenes/mri-segmentation";
import { AdminDashboard } from "./scenes/admin-dashboard";
import { ClosingCta } from "./scenes/closing-cta";

// Scene durations in frames (30fps)
// Scene 1:  0–179    (6s)   Problem Hook
// Scene 2:  180–389  (7s)   Brand Reveal
// Scene 3:  390–839  (15s)  Smart Intake
// Scene 4:  840–1349 (17s)  Doctor Workspace
// Scene 5:  1350–1679(11s)  MRI Segmentation
// Scene 6:  1680–1949(9s)   Admin Dashboard
// Scene 7:  1950–2249(10s)  Closing CTA
// Total: 2250 frames = 75s

const SCENE_DURATIONS = {
  problemHook: 180,
  brandReveal: 210,
  smartIntake: 450,
  doctorWorkspace: 510,
  mriSegmentation: 330,
  adminDashboard: 270,
  closingCta: 300,
} as const;

// B-roll opacity keyframes (absolute global frames)
const B_ROLL_KEYFRAMES: [number, number][] = [
  [0, 0.15],     // Scene 1: Problem — dark, minimal
  [180, 0.35],   // Scene 2: Brand reveal — builds up
  [390, 0.10],   // Scene 3: Smart intake — low
  [840, 0.08],   // Scene 4: Doctor workspace — very low
  [1350, 0.12],  // Scene 5: MRI — dark bg, subtle
  [1680, 0.08],  // Scene 6: Admin dashboard — low
  [1950, 0.40],  // Scene 7: Closing — full brand b-roll
  [2250, 0.35],  // End
];

export const DemoVideo: React.FC = () => {
  return (
    <div style={{ position: "relative", width: 1920, height: 1080 }}>
      {/* Persistent b-roll behind everything */}
      <BRollLayer opacityKeyframes={B_ROLL_KEYFRAMES} />

      {/* Scene sequence */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <Series>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.problemHook}>
            <ProblemHook />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.brandReveal}>
            <BrandReveal />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.smartIntake}>
            <SmartIntake />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.doctorWorkspace}>
            <DoctorWorkspace />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.mriSegmentation}>
            <MriSegmentation />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.adminDashboard}>
            <AdminDashboard />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.closingCta}>
            <ClosingCta />
          </Series.Sequence>
        </Series>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Delete old v1 scene files**

```bash
cd video && rm src/scenes/logo-reveal.tsx src/scenes/agent-intro.tsx src/scenes/patient-screening.tsx src/scenes/routing-and-support.tsx src/scenes/agent-advantages.tsx
```

Note: also delete any other unused legacy scenes that are not imported:

```bash
cd video && ls src/scenes/
```

If `opening.tsx`, `intake-chat.tsx`, `ai-reasoning.tsx`, `doctor-workspace.tsx` (the old one), or `closing.tsx` appear and they are not the new files, delete them:

```bash
cd video && rm -f src/scenes/opening.tsx src/scenes/intake-chat.tsx src/scenes/ai-reasoning.tsx
```

- [ ] **Step 3: Full TypeScript check — must be zero errors**

```bash
cd video && npx tsc --noEmit 2>&1
```

Expected: no output (exit 0). If there are errors, fix them before committing.

Common fixes:
- `readonly` tuple type mismatch → add `as const` assertions or widen type
- Missing import → add import at top of file
- `LucideIcon` type issue in `feature-recap-row.tsx` → change `RECAP_ICONS` type to `React.FC<{ size?: number; color?: string; strokeWidth?: number }>[]`

- [ ] **Step 4: Launch Remotion Studio and verify each scene plays correctly**

```bash
cd video && npm run dev
```

Open `http://localhost:3000` in browser. Use the timeline to scrub through all 7 scenes:
- Frames 0–179: Dark bg, three text lines fade in/out, fade-to-white at end ✓
- Frames 180–389: Dark-to-light transition, logo particles, tagline typewriter, 4 icons ✓
- Frames 390–839: iPhone frame, chat messages, intake form fills, triage card ✓
- Frames 840–1349: Floating desktop window, 3 panels with focus shifting ✓
- Frames 1350–1679: Dark bg, command text, pulsing dots, MRI SVG with overlays ✓
- Frames 1680–1949: Desktop window, KPI bar, kanban with card move ✓
- Frames 1950–2249: Light-to-dark, recap icons exit, logo, tagline, URL ✓

- [ ] **Step 5: Commit**

```bash
cd video && git add src/DemoVideo.tsx && git rm src/scenes/logo-reveal.tsx src/scenes/agent-intro.tsx src/scenes/patient-screening.tsx src/scenes/routing-and-support.tsx src/scenes/agent-advantages.tsx && git commit -m "feat(video): wire v2 scenes in DemoVideo, remove v1 scenes — 75s 7-scene video complete"
```
