# Remotion Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 40-second polished marketing demo video using Remotion that showcases the MediNexus patient journey from intake to resolution.

**Architecture:** Self-contained Remotion project in `video/` directory. Five scene compositions sequenced into one main composition. Shared animation components (typewriter, fade-slide, glow) used across scenes. Theme tokens mirror the web app's Clinical Futurism dark theme exactly.

**Tech Stack:** Remotion 4.0.x, React 19, TypeScript, JetBrains Mono / Geist Sans / Geist Mono fonts

**Spec:** `docs/superpowers/specs/2026-04-01-remotion-demo-video-design.md`

---

## File Structure

```
video/
├── package.json                     # Remotion + React deps
├── tsconfig.json                    # TypeScript config for Remotion
├── .gitignore                       # Ignore node_modules, out/, .remotion/
├── src/
│   ├── Root.tsx                     # Remotion root — registers the composition
│   ├── DemoVideo.tsx                # Main composition — sequences all 5 scenes
│   ├── styles/
│   │   └── theme.ts                # Color tokens, fonts, spacing, glow helpers
│   ├── data/
│   │   └── script.ts               # All demo text content (messages, patients, orders)
│   ├── components/
│   │   ├── typewriter.tsx           # Frame-based character reveal
│   │   ├── fade-slide.tsx           # Reusable fade + slide-up entrance
│   │   ├── message-bubble.tsx       # Chat bubble (user/AI variants)
│   │   ├── dot-matrix-bg.tsx        # Dot-matrix background pattern
│   │   ├── scan-line-overlay.tsx    # Animated scan-line
│   │   ├── medical-glow.tsx         # Glow effect wrapper (cyan/teal/emerald)
│   │   ├── cursor-click.tsx         # Animated cursor with click effect
│   │   └── feature-callout.tsx      # Scene label overlay
│   └── scenes/
│       ├── opening.tsx              # Scene 1: Logo + intake portal
│       ├── intake-chat.tsx          # Scene 2: AI conversation + triage
│       ├── doctor-workspace.tsx     # Scene 3: 3-zone clinical layout
│       ├── ai-reasoning.tsx         # Scene 4: Agent tool calls + response
│       └── closing.tsx              # Scene 5: Discharge + logo tagline
```

---

## Task 1: Scaffold Remotion Project

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "medinexus-demo-video",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "remotion studio src/Root.tsx",
    "build": "remotion render src/Root.tsx DemoVideo out/demo.mp4",
    "upgrade": "remotion upgrade"
  },
  "dependencies": {
    "@remotion/cli": "4.0.443",
    "@remotion/player": "4.0.443",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "remotion": "4.0.443"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
out/
dist/
.remotion/
```

- [ ] **Step 4: Install dependencies**

Run: `cd video && npm install`
Expected: Clean install with no errors.

- [ ] **Step 5: Commit**

```bash
git add video/package.json video/tsconfig.json video/.gitignore video/package-lock.json
git commit -m "chore: scaffold Remotion project for demo video"
```

---

## Task 2: Theme Tokens & Script Data

**Files:**
- Create: `video/src/styles/theme.ts`
- Create: `video/src/data/script.ts`

- [ ] **Step 1: Create theme.ts**

```ts
// Color tokens mapped from web/app/globals.css Clinical Futurism dark theme
// oklch values converted to hex for inline styles

export const colors = {
  background: "#141414",
  foreground: "#f0f0f0",
  card: "#1a1a1a",
  border: "#303030",
  muted: "#242424",
  mutedForeground: "#999999",
  cyan: "#00d9ff",
  teal: "#00b8a9",
  purple: "#6366f1",
  green: "#10b981",
  emerald: "#10b981",
  navy: "#0a0e27",
  amber: "#f59e0b",
  red: "#ef4444",
  white: "#ffffff",
} as const;

export const fonts = {
  display: "JetBrains Mono, monospace",
  body: "Geist Sans, system-ui, sans-serif",
  mono: "Geist Mono, monospace",
} as const;

export const glows = {
  cyan: "0 0 20px rgba(0,217,255,0.3), 0 0 40px rgba(0,217,255,0.1)",
  teal: "0 0 15px rgba(0,184,169,0.3), 0 0 30px rgba(0,184,169,0.1)",
  emerald: "0 0 15px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.1)",
  cyanBorder: "inset 0 0 15px rgba(0,217,255,0.1)",
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
} as const;

// Reusable style fragments
export const gradients = {
  cyanToTeal: "linear-gradient(to right, #00d9ff, #00b8a9)",
  cyanToTealBg: "linear-gradient(to right, #00d9ff, #00b8a9)",
  scanLine:
    "linear-gradient(90deg, transparent, rgba(0,217,255,0.7), transparent)",
  dotMatrix:
    "radial-gradient(circle, rgba(0,217,255,0.1) 1px, transparent 1px)",
} as const;
```

- [ ] **Step 2: Create script.ts**

```ts
// All demo text content centralized for easy editing

export const SCENE_CALLOUTS = {
  opening: "YOUR AI-POWERED HOSPITAL",
  intake: "PATIENTS TRIAGED IN SECONDS",
  doctorWorkspace: "EVERYTHING YOUR TEAM NEEDS, ONE SCREEN",
  aiReasoning: "AI THAT THINKS WITH YOUR DOCTORS",
  closing: "THE FUTURE OF PATIENT CARE",
} as const;

export const INTAKE_MESSAGES = {
  userMessage: "I'm experiencing chest pain",
  aiMessage:
    "I'm sorry to hear that. Let me help you get checked in right away. Can you tell me when the pain started and how severe it is on a scale of 1-10?",
} as const;

export const INTAKE_FORM = {
  fields: [
    { label: "Full Name", value: "Sarah Chen" },
    { label: "Date of Birth", value: "03/15/1985" },
    { label: "Symptoms", value: "Chest pain, shortness of breath" },
  ],
} as const;

export const TRIAGE_RESULT = {
  department: "Cardiology",
  urgency: "Urgent",
  message: "A medical team will see you shortly",
} as const;

export const PATIENT_LIST = [
  { name: "Sarah Chen", urgency: "urgent" as const, complaint: "Chest pain", waitMinutes: 3, selected: true },
  { name: "James Wilson", urgency: "routine" as const, complaint: "Follow-up visit", waitMinutes: 12 },
  { name: "Maria Garcia", urgency: "routine" as const, complaint: "Annual physical", waitMinutes: 18 },
  { name: "Robert Kim", urgency: "routine" as const, complaint: "Knee pain", waitMinutes: 25 },
] as const;

export const VISIT_BRIEF =
  "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history.";

export const ORDERS = [
  { name: "Troponin I", type: "Lab" as const },
  { name: "12-Lead ECG", type: "Lab" as const },
  { name: "Chest X-Ray", type: "Imaging" as const },
] as const;

export const SOAP_NOTE =
  "S: Patient reports substernal chest pain rated 7/10, onset 2 hours ago. Associated with shortness of breath. No radiation. No prior cardiac history.";

export const AI_TOOL_CALLS = [
  { name: "search_patient_records", status: "completed" as const },
  { name: "check_drug_interactions", status: "completed" as const },
  { name: "analyze_lab_results", status: "completed" as const },
] as const;

export const AI_RESPONSE =
  "Based on the elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy.";

export const SUGGESTIONS = [
  "I'd like to check in for a visit",
  "I'm experiencing chest pain",
  "I need to see a doctor today",
  "This is my first time here",
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add video/src/styles/theme.ts video/src/data/script.ts
git commit -m "feat(video): add theme tokens and script data"
```

---

## Task 3: Shared Animation Components

**Files:**
- Create: `video/src/components/typewriter.tsx`
- Create: `video/src/components/fade-slide.tsx`
- Create: `video/src/components/dot-matrix-bg.tsx`
- Create: `video/src/components/scan-line-overlay.tsx`
- Create: `video/src/components/medical-glow.tsx`
- Create: `video/src/components/cursor-click.tsx`
- Create: `video/src/components/message-bubble.tsx`
- Create: `video/src/components/feature-callout.tsx`

- [ ] **Step 1: Create typewriter.tsx**

```tsx
import { useCurrentFrame } from "remotion";

interface TypewriterProps {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame,
  charsPerFrame = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const displayText = text.slice(0, visibleChars);
  const showCursor = visibleChars < text.length && elapsed > 0;

  return (
    <span style={style}>
      {displayText}
      {showCursor && (
        <span style={{ opacity: Math.round((frame % 16) / 8) ? 1 : 0.3 }}>|</span>
      )}
    </span>
  );
};
```

- [ ] **Step 2: Create fade-slide.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

interface FadeSlideProps {
  children: React.ReactNode;
  startFrame: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  style?: React.CSSProperties;
}

export const FadeSlide: React.FC<FadeSlideProps> = ({
  children,
  startFrame,
  direction = "up",
  distance = 30,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12 },
  });

  const translate = {
    up: `translateY(${(1 - progress) * distance}px)`,
    down: `translateY(${(progress - 1) * distance}px)`,
    left: `translateX(${(1 - progress) * distance}px)`,
    right: `translateX(${(progress - 1) * distance}px)`,
  }[direction];

  return (
    <div
      style={{
        opacity: progress,
        transform: translate,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **Step 3: Create dot-matrix-bg.tsx**

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { colors, gradients } from "../styles/theme";

interface DotMatrixBgProps {
  fadeInFrames?: number;
  opacity?: number;
}

export const DotMatrixBg: React.FC<DotMatrixBgProps> = ({
  fadeInFrames = 15,
  opacity = 0.3,
}) => {
  const frame = useCurrentFrame();
  const bgOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: colors.background,
        opacity: bgOpacity,
      }}
    >
      {/* Dot matrix pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: gradients.dotMatrix,
          backgroundSize: "20px 20px",
          opacity,
        }}
      />
      {/* Top-right cyan gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "50%",
          background:
            "linear-gradient(to bottom left, rgba(0,217,255,0.08), transparent)",
        }}
      />
      {/* Bottom-left teal gradient */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "50%",
          height: "50%",
          background:
            "linear-gradient(to top right, rgba(0,184,169,0.08), transparent)",
        }}
      />
    </div>
  );
};
```

- [ ] **Step 4: Create scan-line-overlay.tsx**

```tsx
import { useCurrentFrame } from "remotion";

export const ScanLineOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  // 3-second cycle at 30fps = 90 frames
  const cycleProgress = (frame % 90) / 90;
  const leftPercent = -100 + cycleProgress * 200;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${leftPercent}%`,
          width: "100%",
          height: 2,
          background:
            "linear-gradient(90deg, transparent, rgba(0,217,255,0.7), transparent)",
        }}
      />
    </div>
  );
};
```

- [ ] **Step 5: Create medical-glow.tsx**

```tsx
import { glows } from "../styles/theme";

type GlowVariant = "cyan" | "teal" | "emerald";

interface MedicalGlowProps {
  variant: GlowVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const MedicalGlow: React.FC<MedicalGlowProps> = ({
  variant,
  children,
  style,
}) => {
  return (
    <div style={{ boxShadow: glows[variant], ...style }}>
      {children}
    </div>
  );
};
```

- [ ] **Step 6: Create cursor-click.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors } from "../styles/theme";

interface CursorClickProps {
  appearFrame: number;
  clickFrame: number;
  x: number;
  y: number;
}

export const CursorClick: React.FC<CursorClickProps> = ({
  appearFrame,
  clickFrame,
  x,
  y,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visible = frame >= appearFrame;
  const clicked = frame >= clickFrame;

  const cursorOpacity = visible
    ? spring({ frame: frame - appearFrame, fps, config: { damping: 15 } })
    : 0;

  // Click ripple effect
  const rippleProgress = clicked
    ? interpolate(frame - clickFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  if (!visible) return null;

  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {/* Cursor arrow */}
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        style={{ opacity: cursorOpacity, transform: clicked ? "scale(0.9)" : "scale(1)" }}
      >
        <path
          d="M2 2L18 12L10 14L8 22L2 2Z"
          fill={colors.white}
          stroke={colors.background}
          strokeWidth="1.5"
        />
      </svg>
      {/* Click ripple */}
      {clicked && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 40 * rippleProgress,
            height: 40 * rippleProgress,
            borderRadius: "50%",
            border: `2px solid ${colors.cyan}`,
            opacity: 1 - rippleProgress,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 7: Create message-bubble.tsx**

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, radius } from "../styles/theme";
import { Typewriter } from "./typewriter";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  startFrame: number;
  typewriter?: boolean;
  charsPerFrame?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  text,
  startFrame,
  typewriter = false,
  charsPerFrame = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isUser = role === "user";

  const slideProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12 },
  });

  const slideX = isUser ? (1 - slideProgress) * 50 : (slideProgress - 1) * 50;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity: slideProgress,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 16px",
          borderRadius: radius["2xl"],
          borderBottomRightRadius: isUser ? 4 : radius["2xl"],
          borderBottomLeftRadius: isUser ? radius["2xl"] : 4,
          backgroundColor: isUser
            ? "rgba(0,217,255,0.15)"
            : "rgba(255,255,255,0.06)",
          color: colors.foreground,
          fontSize: 14,
          fontFamily: fonts.body,
          lineHeight: 1.6,
        }}
      >
        {typewriter ? (
          <Typewriter
            text={text}
            startFrame={startFrame + 8}
            charsPerFrame={charsPerFrame}
          />
        ) : (
          text
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 8: Create feature-callout.tsx**

```tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { colors, fonts } from "../styles/theme";

type CalloutPosition =
  | "bottom-center"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "center-below";

interface FeatureCalloutProps {
  text: string;
  position: CalloutPosition;
  startFrame: number;
  endFrame?: number;
}

const positionStyles: Record<CalloutPosition, React.CSSProperties> = {
  "bottom-center": { bottom: 60, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 40, right: 60 },
  "top-center": { top: 40, left: "50%", transform: "translateX(-50%)" },
  "bottom-left": { bottom: 60, left: 60 },
  "center-below": { top: "58%", left: "50%", transform: "translateX(-50%)" },
};

export const FeatureCallout: React.FC<FeatureCalloutProps> = ({
  text,
  position,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14 },
  });

  const exitOpacity =
    endFrame !== undefined
      ? interpolate(frame, [endFrame - 8, endFrame], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        zIndex: 100,
        opacity: enterProgress * exitOpacity,
        transform: `${positionStyles[position].transform ?? ""} translateY(${(1 - enterProgress) * 15}px)`,
      }}
    >
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: colors.cyan,
          textShadow: "0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(0,217,255,0.2)",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

- [ ] **Step 9: Verify all components compile**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add video/src/components/
git commit -m "feat(video): add shared animation components"
```

---

## Task 4: Scene 1 — Opening

**Files:**
- Create: `video/src/scenes/opening.tsx`

- [ ] **Step 1: Create opening.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { colors, fonts, gradients } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { ScanLineOverlay } from "../components/scan-line-overlay";
import { FadeSlide } from "../components/fade-slide";
import { CursorClick } from "../components/cursor-click";
import { FeatureCallout } from "../components/feature-callout";
import { SUGGESTIONS, SCENE_CALLOUTS } from "../data/script";

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12 },
  });

  // Online badge pulse
  const pulseDotOpacity = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <DotMatrixBg fadeInFrames={15} />
      <ScanLineOverlay />

      {/* Header bar */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          maxWidth: 768,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo placeholder circle */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: gradients.cyanToTeal,
              opacity: logoScale,
              transform: `scale(${logoScale})`,
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: gradients.cyanToTeal,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: logoScale,
              transform: `scale(${logoScale})`,
            }}
          >
            MEDI-NEXUS
          </span>
          <span
            style={{
              color: colors.mutedForeground,
              fontSize: 14,
              opacity: logoScale,
            }}
          >
            / Patient Intake
          </span>
        </div>
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,217,255,0.3)",
            color: colors.cyan,
            fontSize: 12,
            letterSpacing: "0.05em",
            opacity: logoScale,
          }}
        >
          HOME
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 80,
          gap: 16,
        }}
      >
        {/* RECEPTION AI ONLINE badge */}
        <FadeSlide startFrame={20} direction="up" distance={20}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              border: "1px solid rgba(0,217,255,0.3)",
              backgroundColor: "rgba(0,217,255,0.05)",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: colors.cyan,
                opacity: pulseDotOpacity,
              }}
            />
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                letterSpacing: "0.15em",
                color: colors.cyan,
              }}
            >
              RECEPTION AI ONLINE
            </span>
          </div>
        </FadeSlide>

        {/* Welcome text */}
        <FadeSlide startFrame={30} direction="up" distance={15}>
          <p
            style={{
              color: colors.mutedForeground,
              fontSize: 14,
              maxWidth: 400,
              textAlign: "center",
              fontFamily: fonts.body,
              lineHeight: 1.6,
            }}
          >
            Welcome! I&apos;m the reception assistant. I&apos;ll help you get checked in
            by collecting some information and directing you to the right department.
          </p>
        </FadeSlide>

        {/* Suggestion cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            maxWidth: 400,
            width: "100%",
            marginTop: 16,
          }}
        >
          {SUGGESTIONS.map((suggestion, i) => {
            const isTarget = i === 1; // "I'm experiencing chest pain"
            return (
              <FadeSlide key={i} startFrame={45 + i * 5} direction="up" distance={20}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${
                      isTarget && frame >= 110
                        ? "rgba(0,217,255,0.4)"
                        : `${colors.border}60`
                    }`,
                    backgroundColor:
                      isTarget && frame >= 110
                        ? "rgba(0,217,255,0.08)"
                        : "rgba(26,26,26,0.4)",
                    fontSize: 12,
                    color:
                      isTarget && frame >= 110
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {suggestion}
                </div>
              </FadeSlide>
            );
          })}
        </div>
      </div>

      {/* Cursor */}
      <CursorClick appearFrame={90} clickFrame={110} x={620} y={530} />

      {/* Feature callout */}
      <FeatureCallout
        text={SCENE_CALLOUTS.opening}
        position="bottom-center"
        startFrame={30}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/opening.tsx
git commit -m "feat(video): add Scene 1 — opening with intake portal"
```

---

## Task 5: Scene 2 — Intake Chat

**Files:**
- Create: `video/src/scenes/intake-chat.tsx`

- [ ] **Step 1: Create intake-chat.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { ScanLineOverlay } from "../components/scan-line-overlay";
import { MessageBubble } from "../components/message-bubble";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import {
  INTAKE_MESSAGES,
  INTAKE_FORM,
  TRIAGE_RESULT,
  SCENE_CALLOUTS,
} from "../data/script";

export const IntakeChat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Triage card entrance
  const triageFrame = 210; // ~7s into this scene
  const triageScale = spring({
    frame: Math.max(0, frame - triageFrame),
    fps,
    config: { damping: 14 },
  });
  const triageBaseScale = interpolate(triageScale, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <DotMatrixBg fadeInFrames={0} />
      <ScanLineOverlay />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          maxWidth: 768,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(to right, #00d9ff, #00b8a9)",
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: "linear-gradient(to right, #00d9ff, #00b8a9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MEDI-NEXUS
          </span>
          <span style={{ color: colors.mutedForeground, fontSize: 14 }}>
            / Patient Intake
          </span>
        </div>
      </div>

      {/* Chat messages area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 768,
          margin: "0 auto",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* User message */}
        <MessageBubble
          role="user"
          text={INTAKE_MESSAGES.userMessage}
          startFrame={5}
        />

        {/* AI response with typewriter */}
        <MessageBubble
          role="assistant"
          text={INTAKE_MESSAGES.aiMessage}
          startFrame={20}
          typewriter
          charsPerFrame={2}
        />

        {/* Form fields */}
        <FadeSlide startFrame={100} direction="up" distance={20}>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: 20,
              backgroundColor: colors.card,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {INTAKE_FORM.fields.map((field, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {field.label}
                </span>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.muted,
                    fontSize: 14,
                    color: colors.foreground,
                    fontFamily: fonts.body,
                  }}
                >
                  <Typewriter
                    text={field.value}
                    startFrame={115 + i * 20}
                    charsPerFrame={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        </FadeSlide>

        {/* Triage status card */}
        {frame >= triageFrame && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                borderRadius: radius["2xl"],
                border: "1px solid rgba(16,185,129,0.3)",
                backgroundColor: "rgba(16,185,129,0.05)",
                padding: 16,
                opacity: triageScale,
                transform: `scale(${triageBaseScale})`,
                boxShadow: triageScale > 0.5 ? glows.emerald : "none",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#34d399",
                    fontFamily: fonts.body,
                  }}
                >
                  Check-in Complete
                </span>
              </div>

              {/* Department */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                  />
                  <path
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                  />
                </svg>
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>Directed to</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.department}
                </span>
              </div>

              {/* Message */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {TRIAGE_RESULT.message}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature callout */}
      <FeatureCallout
        text={SCENE_CALLOUTS.intake}
        position="top-right"
        startFrame={triageFrame + 20}
      />
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/intake-chat.tsx
git commit -m "feat(video): add Scene 2 — intake chat with triage card"
```

---

## Task 6: Scene 3 — Doctor Workspace

**Files:**
- Create: `video/src/scenes/doctor-workspace.tsx`

- [ ] **Step 1: Create doctor-workspace.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import { PATIENT_LIST, VISIT_BRIEF, ORDERS, SOAP_NOTE, SCENE_CALLOUTS } from "../data/script";

const URGENCY_COLORS = {
  critical: "#ef4444",
  urgent: "#f59e0b",
  routine: "#10b981",
} as const;

export const DoctorWorkspace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel slide-in progress
  const panelProgress = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <FadeSlide startFrame={5} direction="down" distance={20}>
        <div
          style={{
            height: 52,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            backgroundColor: colors.card,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.1em",
                backgroundImage: "linear-gradient(to right, #00d9ff, #00b8a9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MEDI-NEXUS
            </span>
            <div
              style={{
                padding: "6px 16px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.muted,
                color: colors.mutedForeground,
                fontSize: 13,
                fontFamily: fonts.body,
                width: 300,
              }}
            >
              Search patients...
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                  stroke={colors.mutedForeground}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colors.cyan,
                }}
              />
            </div>
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: colors.muted,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: colors.mutedForeground,
                fontFamily: fonts.display,
              }}
            >
              DR
            </div>
          </div>
        </div>
      </FadeSlide>

      {/* 3-Zone Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Zone A: Patient List */}
        <div
          style={{
            width: 240,
            borderRight: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * -240}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
            padding: 12,
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: colors.mutedForeground,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            My Patients
          </span>

          {PATIENT_LIST.map((patient, i) => (
            <FadeSlide key={i} startFrame={20 + i * 8} direction="left" distance={15}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${patient.selected ? "rgba(0,217,255,0.3)" : "transparent"}`,
                  backgroundColor: patient.selected ? "rgba(0,217,255,0.1)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: URGENCY_COLORS[patient.urgency],
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, fontFamily: fonts.body, flex: 1 }}>
                    {patient.name}
                  </span>
                  <span style={{ fontSize: 10, color: colors.mutedForeground }}>{patient.waitMinutes}m</span>
                </div>
                <span style={{ fontSize: 11, color: colors.mutedForeground, paddingLeft: 16 }}>
                  {patient.complaint}
                </span>
              </div>
            </FadeSlide>
          ))}
        </div>

        {/* Zone B: Clinical Workspace */}
        <div
          style={{
            flex: 1,
            transform: `scaleX(${interpolate(panelProgress, [0, 1], [0.8, 1])})`,
            opacity: panelProgress,
            padding: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Patient card */}
          <FadeSlide startFrame={30} direction="up" distance={15}>
            <div
              style={{
                padding: 16,
                borderRadius: radius.lg,
                border: "1px solid rgba(0,217,255,0.2)",
                backgroundColor: colors.card,
                boxShadow: frame > 40 ? glows.cyan : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>
                    Sarah Chen
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: "rgba(245,158,11,0.15)",
                      color: colors.amber,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    URGENT
                  </span>
                </div>
                <span style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.body }}>
                  42F — Chief Complaint: Chest pain
                </span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 12, color: colors.mutedForeground }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>128/82</div>
                  <div>BP</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>92</div>
                  <div>HR</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>98%</div>
                  <div>SpO2</div>
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* Two columns: Brief+Orders | Notes */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            {/* Left: Brief + Orders */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Pre-visit brief */}
              <FadeSlide startFrame={60} direction="up" distance={15}>
                <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.purple} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Pre-Visit Brief</span>
                  </div>
                  <div style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.6 }}>
                    <Typewriter text={VISIT_BRIEF} startFrame={70} charsPerFrame={3} />
                  </div>
                </div>
              </FadeSlide>

              {/* Orders */}
              <FadeSlide startFrame={80} direction="up" distance={15}>
                <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Orders</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ORDERS.map((order, i) => (
                      <FadeSlide key={i} startFrame={90 + i * 3} direction="up" distance={10}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: radius.md, backgroundColor: colors.muted }}>
                          <span style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              backgroundColor: order.type === "Lab" ? "rgba(99,102,241,0.15)" : "rgba(0,184,169,0.15)",
                              color: order.type === "Lab" ? colors.purple : colors.teal,
                              fontWeight: 500,
                            }}
                          >
                            {order.type}
                          </span>
                        </div>
                      </FadeSlide>
                    ))}
                  </div>
                </div>
              </FadeSlide>
            </div>

            {/* Right: Clinical Notes */}
            <FadeSlide startFrame={100} direction="up" distance={15} style={{ flex: 1 }}>
              <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke={colors.green} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Clinical Notes</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, backgroundColor: "rgba(99,102,241,0.15)", color: colors.purple, marginLeft: "auto" }}>AI Draft</span>
                </div>
                <div style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.mono, lineHeight: 1.8, whiteSpace: "pre-wrap", padding: 12, borderRadius: radius.md, backgroundColor: colors.muted, minHeight: 200 }}>
                  <Typewriter text={SOAP_NOTE} startFrame={110} charsPerFrame={2} />
                </div>
              </div>
            </FadeSlide>
          </div>
        </div>

        {/* Zone C: AI Panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * 320}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Tab header */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 16px", borderBottom: `1px solid ${colors.border}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: fonts.display, fontSize: 12, fontWeight: 600, color: colors.foreground }}>AI Assistant</span>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}` }}>
            {["Insights", "Chat"].map((tab, i) => (
              <div
                key={tab}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  textAlign: "center",
                  fontSize: 12,
                  fontFamily: fonts.body,
                  color: i === 0 ? colors.cyan : colors.mutedForeground,
                  borderBottom: i === 0 ? `2px solid ${colors.cyan}` : "none",
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          {/* AI content */}
          <div style={{ padding: 16 }}>
            <FadeSlide startFrame={50} direction="up" distance={10}>
              <div style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.muted, fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.6 }}>
                <span style={{ color: colors.cyan, fontWeight: 600 }}>Patient Context:</span>{" "}
                Sarah Chen, 42F, presenting with acute chest pain. Cardiology referral from intake triage.
              </div>
            </FadeSlide>
          </div>
        </div>
      </div>

      {/* Feature callout */}
      <FeatureCallout text={SCENE_CALLOUTS.doctorWorkspace} position="top-center" startFrame={30} />
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/doctor-workspace.tsx
git commit -m "feat(video): add Scene 3 — doctor clinical workspace"
```

---

## Task 7: Scene 4 — AI Reasoning

**Files:**
- Create: `video/src/scenes/ai-reasoning.tsx`

- [ ] **Step 1: Create ai-reasoning.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import { AI_TOOL_CALLS, AI_RESPONSE, SCENE_CALLOUTS } from "../data/script";

export const AiReasoning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Thinking dots animation
  const thinkingVisible = frame < 60;
  const dot1Opacity = 0.3 + 0.7 * Math.sin((frame / 10) * Math.PI);
  const dot2Opacity = 0.3 + 0.7 * Math.sin(((frame - 4) / 10) * Math.PI);
  const dot3Opacity = 0.3 + 0.7 * Math.sin(((frame - 8) / 10) * Math.PI);

  // Tool call timing
  const toolStartFrame = 20;

  // Button glow pulse
  const buttonGlowOpacity = frame > 180 ? 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI) : 0;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* AI Panel — enlarged to fill most of the screen */}
      <div
        style={{
          width: 800,
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          border: `1px solid ${colors.border}`,
          boxShadow: glows.cyan,
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: fonts.display, fontSize: 14, fontWeight: 600, color: colors.foreground }}>
            AI Assistant — Chat
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: colors.mutedForeground }}>
            Patient: Sarah Chen
          </span>
        </div>

        {/* Chat content */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* User message */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: radius["2xl"],
                borderBottomRightRadius: 4,
                backgroundColor: "rgba(0,217,255,0.15)",
                color: colors.foreground,
                fontSize: 14,
                fontFamily: fonts.body,
                maxWidth: "75%",
              }}
            >
              Review this patient's labs and recommend next steps
            </div>
          </div>

          {/* Thinking indicator */}
          {thinkingVisible && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: radius["2xl"],
                  borderBottomLeftRadius: 4,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>Analyzing</span>
                <span style={{ color: colors.cyan, opacity: dot1Opacity }}>.</span>
                <span style={{ color: colors.cyan, opacity: dot2Opacity }}>.</span>
                <span style={{ color: colors.cyan, opacity: dot3Opacity }}>.</span>
              </div>
            </div>
          )}

          {/* Tool calls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {AI_TOOL_CALLS.map((tool, i) => {
              const toolFrame = toolStartFrame + i * 10;
              const toolProgress = spring({
                frame: Math.max(0, frame - toolFrame),
                fps,
                config: { damping: 14 },
              });
              const statusFrame = toolFrame + 15;
              const isCompleted = frame >= statusFrame;

              if (frame < toolFrame) return null;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: radius.md,
                    backgroundColor: colors.muted,
                    opacity: toolProgress,
                    transform: `translateY(${(1 - toolProgress) * 15}px)`,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.mono, flex: 1 }}>
                    {tool.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: isCompleted ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: isCompleted ? colors.green : colors.amber,
                      fontWeight: 500,
                    }}
                  >
                    {isCompleted ? "completed" : "running..."}
                  </span>
                </div>
              );
            })}
          </div>

          {/* AI Response */}
          {frame >= 80 && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: radius["2xl"],
                  borderBottomLeftRadius: 4,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: colors.foreground,
                  fontSize: 14,
                  fontFamily: fonts.body,
                  lineHeight: 1.7,
                  maxWidth: "85%",
                }}
              >
                <Typewriter text={AI_RESPONSE} startFrame={85} charsPerFrame={2} />
              </div>
            </div>
          )}

          {/* Place Order button */}
          {frame >= 180 && (
            <FadeSlide startFrame={180} direction="up" distance={10}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    padding: "8px 20px",
                    borderRadius: radius.md,
                    background: "linear-gradient(to right, #00d9ff, #00b8a9)",
                    color: colors.white,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: fonts.body,
                    boxShadow: `0 0 ${20 * buttonGlowOpacity}px rgba(0,217,255,${0.3 * buttonGlowOpacity}), 0 0 ${40 * buttonGlowOpacity}px rgba(0,217,255,${0.1 * buttonGlowOpacity})`,
                  }}
                >
                  Place Order
                </div>
              </div>
            </FadeSlide>
          )}
        </div>
      </div>

      {/* Feature callout */}
      <FeatureCallout text={SCENE_CALLOUTS.aiReasoning} position="bottom-left" startFrame={70} />
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/ai-reasoning.tsx
git commit -m "feat(video): add Scene 4 — AI agent reasoning"
```

---

## Task 8: Scene 5 — Closing

**Files:**
- Create: `video/src/scenes/closing.tsx`

- [ ] **Step 1: Create closing.tsx**

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, gradients } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { SCENE_CALLOUTS } from "../data/script";

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Discharge button click at frame 15, then ripple
  const showRipple = frame >= 15;
  const rippleProgress = showRipple
    ? interpolate(frame - 15, [0, 20], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  // Workspace fade out starts at frame 30
  const workspaceFade = interpolate(frame, [30, 54], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo entrance starts at frame 60
  const logoProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 15 },
  });

  // Tagline fade in 15 frames after logo
  const taglineProgress = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { damping: 14 },
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      {/* Dot matrix returns with logo */}
      {frame >= 55 && <DotMatrixBg fadeInFrames={15} opacity={0.15} />}

      {/* Workspace remnant fading out */}
      {workspaceFade > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: workspaceFade,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 1200,
              height: 700,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.card,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 24,
              position: "relative",
            }}
          >
            {/* Discharge button */}
            <div
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                backgroundColor: frame >= 15 ? colors.green : colors.muted,
                color: colors.white,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: fonts.body,
                position: "relative",
              }}
            >
              Discharge Patient
              {showRipple && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 200 * rippleProgress,
                    height: 200 * rippleProgress,
                    borderRadius: "50%",
                    border: `2px solid ${colors.green}`,
                    opacity: 1 - rippleProgress,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logo + Tagline */}
      {frame >= 55 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: gradients.cyanToTeal,
              opacity: logoProgress,
              transform: `scale(${logoProgress})`,
              boxShadow: logoProgress > 0.5 ? glows.cyan : "none",
            }}
          />

          {/* Brand name */}
          <div
            style={{
              opacity: logoProgress,
              transform: `scale(${interpolate(logoProgress, [0, 1], [0.9, 1])})`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: "0.12em",
                backgroundImage: gradients.cyanToTeal,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MEDI-NEXUS
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              opacity: taglineProgress,
              transform: `translateY(${(1 - taglineProgress) * 10}px)`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: colors.cyan,
                textShadow: "0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(0,217,255,0.2)",
                textTransform: "uppercase",
              }}
            >
              {SCENE_CALLOUTS.closing}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/closing.tsx
git commit -m "feat(video): add Scene 5 — closing with logo and tagline"
```

---

## Task 9: Main Composition & Root

**Files:**
- Create: `video/src/DemoVideo.tsx`
- Create: `video/src/Root.tsx`

- [ ] **Step 1: Create DemoVideo.tsx**

```tsx
import { Series } from "remotion";
import { Opening } from "./scenes/opening";
import { IntakeChat } from "./scenes/intake-chat";
import { DoctorWorkspace } from "./scenes/doctor-workspace";
import { AiReasoning } from "./scenes/ai-reasoning";
import { Closing } from "./scenes/closing";

// Scene durations in frames (30fps)
// Scene 1: 0-120    (4s)
// Scene 2: 120-420  (10s)
// Scene 3: 420-780  (12s)
// Scene 4: 780-1020 (8s)
// Scene 5: 1020-1200 (6s)
// Total: 1200 frames = 40s

const SCENE_DURATIONS = {
  opening: 120,
  intakeChat: 300,
  doctorWorkspace: 360,
  aiReasoning: 240,
  closing: 180,
} as const;

export const DemoVideo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={SCENE_DURATIONS.opening}>
        <Opening />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_DURATIONS.intakeChat}>
        <IntakeChat />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_DURATIONS.doctorWorkspace}>
        <DoctorWorkspace />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_DURATIONS.aiReasoning}>
        <AiReasoning />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_DURATIONS.closing}>
        <Closing />
      </Series.Sequence>
    </Series>
  );
};
```

- [ ] **Step 2: Create Root.tsx**

```tsx
import { Composition, staticFile } from "remotion";
import { DemoVideo } from "./DemoVideo";

// Font face declarations loaded via style element
// Note: staticFile() serves files from the public/ directory
const fontStyles = [
  "@font-face {",
  "  font-family: 'JetBrains Mono';",
  `  src: url('${staticFile("fonts/JetBrainsMono-VariableFont_wght.ttf")}') format('truetype');`,
  "  font-weight: 100 800;",
  "  font-display: block;",
  "}",
].join("\n");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <style>{fontStyles}</style>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
```

- [ ] **Step 3: Verify compilation**

Run: `cd video && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Launch Remotion Studio to verify**

Run: `cd video && npm run dev`
Expected: Remotion Studio opens in browser. You should see the DemoVideo composition listed. Scrubbing the timeline should show all 5 scenes animating correctly.

- [ ] **Step 5: Commit**

```bash
git add video/src/DemoVideo.tsx video/src/Root.tsx
git commit -m "feat(video): add main composition and Remotion root — all scenes wired"
```

---

## Task 10: Font Loading & Final Render

**Files:**
- Create: `video/public/fonts/` (font files)

- [ ] **Step 1: Download JetBrains Mono font**

Run:
```bash
mkdir -p video/public/fonts
curl -L "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" -o /tmp/jbmono.zip
unzip -o /tmp/jbmono.zip -d /tmp/jbmono
cp /tmp/jbmono/fonts/variable/JetBrainsMono-VariableFont_wght.ttf video/public/fonts/
```
Expected: Font file exists at `video/public/fonts/JetBrainsMono-VariableFont_wght.ttf`

- [ ] **Step 2: Copy Geist fonts if available**

Run:
```bash
cp web/node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2 video/public/fonts/ 2>/dev/null || echo "Geist Sans not found — system fallback will be used"
cp web/node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2 video/public/fonts/ 2>/dev/null || echo "Geist Mono not found — system fallback will be used"
```

JetBrains Mono is the critical display font. Geist fonts are nice-to-have — `system-ui` and `monospace` fallbacks work fine.

- [ ] **Step 3: Verify in Studio**

Run: `cd video && npm run dev`
Expected: Remotion Studio shows JetBrains Mono rendering correctly on MEDI-NEXUS logos and feature callout labels.

- [ ] **Step 4: Render the video**

Run: `cd video && npm run build`
Expected: Video renders to `video/out/demo.mp4` — 1920x1080, 30fps, ~40 seconds.

- [ ] **Step 5: Commit**

```bash
git add video/public/fonts/
git commit -m "feat(video): add font files and finalize demo video"
```

---

## Task 11: Gitignore Cleanup

**Files:**
- Modify: `.gitignore` (root)

- [ ] **Step 1: Ensure .superpowers/ is gitignored**

Run: `grep -q '.superpowers/' .gitignore 2>/dev/null || echo '.superpowers/' >> .gitignore`

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to gitignore"
```
