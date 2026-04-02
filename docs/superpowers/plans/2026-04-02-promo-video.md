# MediNexus Promotion Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 65-second cinematic promotion video for MediNexus using Remotion, centered on the AI agent as the hero.

**Architecture:** 6 scenes sequenced via Remotion `<Series>`. A persistent `<BRollLayer>` renders behind all content with variable opacity. UI demo screens render inside `<FloatingScreen>` containers (macOS-style browser chrome with shadow). Existing components (Typewriter, FadeSlide, MessageBubble, etc.) are reused inside the new scene compositions.

**Tech Stack:** Remotion 4.0.443, React 19, TypeScript

---

## File Structure

### New files to create:
| File | Responsibility |
|------|---------------|
| `video/src/components/floating-screen.tsx` | macOS-style browser container with traffic light dots, shadow, zoom animations |
| `video/src/components/b-roll-layer.tsx` | Persistent background: composes particle network + DNA helix + pulse wave |
| `video/src/components/particle-network.tsx` | Animated particle nodes with connecting lines, parallax drift |
| `video/src/components/dna-helix.tsx` | Rotating wireframe DNA double helix (SVG) |
| `video/src/components/pulse-wave.tsx` | ECG-style animated line with cyan glow trail |
| `video/src/components/advantage-card.tsx` | Glass-style card with icon + feature name for Scene 5 |
| `video/src/components/logo-assembly.tsx` | Particles converging into MEDI-NEXUS logo shape |
| `video/src/scenes/logo-reveal.tsx` | Scene 1: Brand intro with b-roll + logo assembly |
| `video/src/scenes/agent-intro.tsx` | Scene 2: "ONE AGENT. EVERY WORKFLOW." + feature cascade |
| `video/src/scenes/patient-screening.tsx` | Scene 3: Intake chat inside FloatingScreen with zoom |
| `video/src/scenes/routing-and-support.tsx` | Scene 4: Doctor workspace + AI panel in FloatingScreen |
| `video/src/scenes/agent-advantages.tsx` | Scene 5: Three advantage cards floating in particle field |
| `video/src/scenes/closing-cta.tsx` | Scene 6: Logo assembly + tagline |

### Existing files to modify:
| File | Changes |
|------|---------|
| `video/src/Root.tsx` | Update `durationInFrames` from 1200 to 1950 |
| `video/src/DemoVideo.tsx` | Replace 5 old scenes with 6 new scenes + BRollLayer |
| `video/src/data/script.ts` | Add promo-specific text (agent intro lines, advantage labels, new callouts) |
| `video/src/styles/theme.ts` | Add floating screen colors (traffic light dots, window chrome) |

### Existing files reused as-is (no changes needed):
- `video/src/components/typewriter.tsx`
- `video/src/components/fade-slide.tsx`
- `video/src/components/message-bubble.tsx`
- `video/src/components/dot-matrix-bg.tsx`
- `video/src/components/scan-line-overlay.tsx`
- `video/src/components/medical-glow.tsx`
- `video/src/components/cursor-click.tsx`
- `video/src/components/feature-callout.tsx`

---

## Verification

Since this is a Remotion video project, visual verification replaces unit tests. After each task:

```bash
cd video && npx remotion studio src/Root.tsx
```

Open `http://localhost:3000` in the browser, navigate to the scene, and scrub through the timeline to verify animations render correctly.

---

### Task 1: Update script data and theme tokens

**Files:**
- Modify: `video/src/data/script.ts`
- Modify: `video/src/styles/theme.ts`

- [ ] **Step 1: Add promo text content to script.ts**

Add these new exports to the bottom of `video/src/data/script.ts`:

```typescript
// --- Promo Video Content ---

export const PROMO_TAGLINE = "Intelligent Healthcare, Automated";

export const PROMO_CLOSING_TAGLINE = "THE FUTURE OF PATIENT CARE";

export const AGENT_INTRO_HEADLINES = {
  line1: "ONE AGENT.",
  line2: "EVERY WORKFLOW.",
} as const;

export const AGENT_INTRO_FEATURES = [
  { text: "Screens patients automatically", icon: "stethoscope" as const },
  { text: "Routes to the right department", icon: "routing" as const },
  { text: "Assists doctors in real-time", icon: "brain" as const },
] as const;

export const AGENT_ADVANTAGES = [
  { title: "Automated Patient Screening", icon: "stethoscope" as const },
  { title: "Intelligent Department Routing", icon: "routing" as const },
  { title: "Real-Time Clinical Support", icon: "brain" as const },
] as const;

export const PROMO_CALLOUTS = {
  patientScreening: "AUTOMATIC PATIENT SCREENING",
  routingSupport: "INTELLIGENT ROUTING & CLINICAL SUPPORT",
} as const;
```

- [ ] **Step 2: Add floating screen colors to theme.ts**

Add a `windowChrome` section to the bottom of `video/src/styles/theme.ts`:

```typescript
export const windowChrome = {
  trafficRed: "#FF5F57",
  trafficYellow: "#FFBD2E",
  trafficGreen: "#27C93F",
  titleBarBg: "rgba(255,255,255,0.03)",
  containerBorder: "rgba(255,255,255,0.08)",
  containerShadow: "0 25px 60px rgba(0,0,0,0.5)",
  dotSize: 8,
  dotGap: 8,
  titleBarHeight: 32,
  borderRadius: 12,
} as const;
```

- [ ] **Step 3: Verify imports work**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add video/src/data/script.ts video/src/styles/theme.ts
git commit -m "feat(video): add promo script content and window chrome theme tokens"
```

---

### Task 2: Particle Network component

**Files:**
- Create: `video/src/components/particle-network.tsx`

- [ ] **Step 1: Create the particle network component**

Create `video/src/components/particle-network.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  layer: "front" | "back";
}

// Deterministic particle positions (seeded from index)
const generateParticles = (count: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 137.508) % 1; // golden angle distribution
    const seed2 = ((i * 97.531 + 43) % 100) / 100;
    const seed3 = ((i * 53.217 + 17) % 100) / 100;
    particles.push({
      x: (seed * 1920),
      y: (seed2 * 1080),
      size: 2 + seed3 * 3,
      speed: 0.3 + seed3 * 0.7,
      layer: i % 3 === 0 ? "back" : "front",
    });
  }
  return particles;
};

const PARTICLES = generateParticles(50);
const CONNECTION_DISTANCE = 150;

interface ParticleNetworkProps {
  opacity?: number;
  fadeInFrames?: number;
}

export const ParticleNetwork: React.FC<ParticleNetworkProps> = ({
  opacity = 0.3,
  fadeInFrames = 30,
}) => {
  const frame = useCurrentFrame();

  const fadeIn = fadeInFrames <= 0
    ? 1
    : interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateRight: "clamp",
      });

  // Animate particle positions
  const getPos = (p: Particle) => {
    const drift = frame * p.speed * 0.3;
    const x = ((p.x + drift * (p.layer === "front" ? 1 : 0.5)) % 1960) - 20;
    const y = p.y + Math.sin(frame * 0.02 * p.speed + p.x) * 20;
    return { x, y };
  };

  const positions = PARTICLES.map(getPos);

  // Build connection lines
  const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DISTANCE) {
        lines.push({
          x1: positions[i].x,
          y1: positions[i].y,
          x2: positions[j].x,
          y2: positions[j].y,
          opacity: 1 - dist / CONNECTION_DISTANCE,
        });
      }
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: fadeIn * opacity,
        overflow: "hidden",
      }}
    >
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        {/* Connection lines */}
        {lines.map((line, i) => (
          <line
            key={`l-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={colors.cyan}
            strokeWidth={0.5}
            opacity={line.opacity * 0.4}
          />
        ))}
        {/* Particles */}
        {PARTICLES.map((p, i) => {
          const pos = positions[i];
          const particleOpacity = p.layer === "back" ? 0.4 : 0.8;
          return (
            <circle
              key={`p-${i}`}
              cx={pos.x}
              cy={pos.y}
              r={p.size * (p.layer === "back" ? 0.7 : 1)}
              fill={colors.cyan}
              opacity={particleOpacity}
              filter={p.layer === "back" ? "blur(1px)" : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/particle-network.tsx
git commit -m "feat(video): add particle network component with drift and connections"
```

---

### Task 3: DNA Helix component

**Files:**
- Create: `video/src/components/dna-helix.tsx`

- [ ] **Step 1: Create the DNA helix component**

Create `video/src/components/dna-helix.tsx`:

```tsx
import { useCurrentFrame } from "remotion";
import { colors } from "../styles/theme";

interface DnaHelixProps {
  x?: number;
  y?: number;
  height?: number;
  opacity?: number;
}

export const DnaHelix: React.FC<DnaHelixProps> = ({
  x = 1600,
  y = 200,
  height = 400,
  opacity = 0.25,
}) => {
  const frame = useCurrentFrame();
  const rotation = frame * 0.8; // degrees per frame

  // Generate helix points
  const pointCount = 20;
  const points: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const angle = t * Math.PI * 4 + (rotation * Math.PI) / 180;
    const yPos = t * height;
    const radius = 30;

    points.push({
      x1: Math.cos(angle) * radius,
      y1: yPos,
      x2: Math.cos(angle + Math.PI) * radius,
      y2: yPos,
      t,
    });
  }

  return (
    <svg
      width="100"
      height={height}
      viewBox={`-40 0 80 ${height}`}
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        overflow: "visible",
      }}
    >
      {/* Strand 1 */}
      <polyline
        points={points.map((p) => `${p.x1},${p.y1}`).join(" ")}
        fill="none"
        stroke={colors.cyan}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Strand 2 */}
      <polyline
        points={points.map((p) => `${p.x2},${p.y2}`).join(" ")}
        fill="none"
        stroke={colors.teal}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Rungs */}
      {points
        .filter((_, i) => i % 2 === 0)
        .map((p, i) => (
          <line
            key={i}
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={colors.cyan}
            strokeWidth={0.8}
            opacity={0.3}
          />
        ))}
      {/* Node dots */}
      {points.map((p, i) => (
        <g key={`dots-${i}`}>
          <circle cx={p.x1} cy={p.y1} r={2} fill={colors.cyan} opacity={0.7} />
          <circle cx={p.x2} cy={p.y2} r={2} fill={colors.teal} opacity={0.7} />
        </g>
      ))}
    </svg>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/dna-helix.tsx
git commit -m "feat(video): add rotating DNA helix wireframe component"
```

---

### Task 4: Pulse Wave component

**Files:**
- Create: `video/src/components/pulse-wave.tsx`

- [ ] **Step 1: Create the pulse wave component**

Create `video/src/components/pulse-wave.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";

interface PulseWaveProps {
  y?: number;
  opacity?: number;
  speed?: number;
}

export const PulseWave: React.FC<PulseWaveProps> = ({
  y = 540,
  opacity = 0.3,
  speed = 4,
}) => {
  const frame = useCurrentFrame();

  // ECG-style path that draws across the screen
  const drawProgress = (frame * speed) % 2200; // loop across wider than screen

  // Generate ECG-like wave points
  const generateEcgPath = (offsetX: number): string => {
    const points: string[] = [];
    const segments = 40;
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * 1920 + offsetX;
      const t = i / segments;
      let yOffset = 0;

      // Create ECG-like spike pattern
      const cycle = t * 4; // 4 cycles across width
      const phase = cycle % 1;

      if (phase > 0.4 && phase < 0.45) {
        yOffset = -8; // small P wave
      } else if (phase > 0.48 && phase < 0.5) {
        yOffset = -40; // QRS spike up
      } else if (phase > 0.5 && phase < 0.52) {
        yOffset = 15; // QRS dip down
      } else if (phase > 0.55 && phase < 0.62) {
        yOffset = -6; // T wave
      }

      points.push(`${x},${y + yOffset}`);
    }
    return `M${points.join(" L")}`;
  };

  const pathD = generateEcgPath(-drawProgress % 1920);

  // Glow trail mask: only show portion near the "draw head"
  const headX = drawProgress % 1920;
  const trailLength = 400;

  return (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        overflow: "hidden",
      }}
    >
      <defs>
        <linearGradient id="pulseTrail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.cyan} stopOpacity="0" />
          <stop offset="70%" stopColor={colors.cyan} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colors.cyan} stopOpacity="1" />
        </linearGradient>
        <mask id="pulseMask">
          <rect
            x={headX - trailLength}
            y="0"
            width={trailLength}
            height="1080"
            fill="url(#pulseTrail)"
          />
        </mask>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={colors.cyan}
        strokeWidth={2}
        mask="url(#pulseMask)"
      />
      {/* Glow dot at head */}
      <circle
        cx={headX}
        cy={y}
        r={4}
        fill={colors.cyan}
        opacity={0.8}
      />
    </svg>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/pulse-wave.tsx
git commit -m "feat(video): add ECG pulse wave component with glow trail"
```

---

### Task 5: B-Roll Layer (composes particle network + DNA helix + pulse wave)

**Files:**
- Create: `video/src/components/b-roll-layer.tsx`

- [ ] **Step 1: Create the b-roll layer component**

Create `video/src/components/b-roll-layer.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "./particle-network";
import { DnaHelix } from "./dna-helix";
import { PulseWave } from "./pulse-wave";

interface BRollLayerProps {
  /**
   * Opacity keyframes: array of [frame, opacity] pairs.
   * Example: [[0, 0.4], [360, 0.15], [840, 0.15], [1440, 0.4]]
   */
  opacityKeyframes: [number, number][];
}

export const BRollLayer: React.FC<BRollLayerProps> = ({ opacityKeyframes }) => {
  const frame = useCurrentFrame();

  const frames = opacityKeyframes.map(([f]) => f);
  const values = opacityKeyframes.map(([, v]) => v);

  const currentOpacity = interpolate(frame, frames, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        opacity: currentOpacity,
      }}
    >
      <ParticleNetwork opacity={1} fadeInFrames={30} />
      <DnaHelix x={1600} y={150} height={400} opacity={0.25} />
      <DnaHelix x={200} y={500} height={300} opacity={0.15} />
      <PulseWave y={900} opacity={0.3} speed={3} />
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/b-roll-layer.tsx
git commit -m "feat(video): add b-roll layer composing particles, DNA, and pulse wave"
```

---

### Task 6: Floating Screen container

**Files:**
- Create: `video/src/components/floating-screen.tsx`

- [ ] **Step 1: Create the floating screen component**

Create `video/src/components/floating-screen.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, windowChrome } from "../styles/theme";

interface FloatingScreenProps {
  children: React.ReactNode;
  /** Frame when the container slides into view */
  enterFrame?: number;
  /** Frame when zoom-in starts (chrome fades, content fills) */
  zoomInFrame?: number;
  /** Frame when zoom-out starts (content shrinks back into container) */
  zoomOutFrame?: number;
  /** Frame when the container exits */
  exitFrame?: number;
  /** Width as percentage of 1920px frame */
  widthPercent?: number;
  /** Entrance direction */
  enterFrom?: "bottom" | "left" | "right";
}

export const FloatingScreen: React.FC<FloatingScreenProps> = ({
  children,
  enterFrame = 0,
  zoomInFrame,
  zoomOutFrame,
  exitFrame,
  widthPercent = 75,
  enterFrom = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerWidth = (1920 * widthPercent) / 100;
  const containerHeight = containerWidth * (9 / 16); // 16:9 aspect

  // --- Entrance animation ---
  const enterProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 14 },
  });

  // --- Zoom animation ---
  // zoomProgress: 0 = framed view, 1 = full screen
  let zoomProgress = 0;
  if (zoomInFrame !== undefined) {
    const zoomInP = spring({
      frame: Math.max(0, frame - zoomInFrame),
      fps,
      config: { damping: 12 },
    });
    zoomProgress = zoomInP;
  }
  if (zoomOutFrame !== undefined && frame >= zoomOutFrame) {
    const zoomOutP = spring({
      frame: Math.max(0, frame - zoomOutFrame),
      fps,
      config: { damping: 12 },
    });
    zoomProgress = 1 - zoomOutP;
  }

  // --- Exit animation ---
  let exitProgress = 1; // 1 = visible, 0 = gone
  if (exitFrame !== undefined) {
    exitProgress = interpolate(frame, [exitFrame, exitFrame + 15], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // --- Compute transforms ---
  // Scale from container size to full screen
  const scaleX = interpolate(zoomProgress, [0, 1], [1, 1920 / containerWidth]);
  const scaleY = interpolate(zoomProgress, [0, 1], [1, 1080 / containerHeight]);
  const scale = Math.min(scaleX, scaleY);

  // Chrome opacity fades out during zoom
  const chromeOpacity = interpolate(zoomProgress, [0, 0.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Entrance slide offset
  const enterOffset = {
    bottom: { x: 0, y: (1 - enterProgress) * 200 },
    left: { x: (enterProgress - 1) * 200, y: 0 },
    right: { x: (1 - enterProgress) * 200, y: 0 },
  }[enterFrom];

  // Scale bump on entrance
  const enterScale = interpolate(enterProgress, [0, 1], [0.95, 1]);

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        opacity: enterProgress * exitProgress,
        transform: `translate(${enterOffset.x}px, ${enterOffset.y}px) scale(${enterScale * scale})`,
      }}
    >
      <div
        style={{
          width: containerWidth,
          borderRadius: windowChrome.borderRadius,
          overflow: "hidden",
          border: `1px solid ${windowChrome.containerBorder}`,
          boxShadow: chromeOpacity > 0.01 ? windowChrome.containerShadow : "none",
          backgroundColor: colors.card,
        }}
      >
        {/* Window chrome title bar */}
        <div
          style={{
            height: windowChrome.titleBarHeight * chromeOpacity,
            backgroundColor: windowChrome.titleBarBg,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: windowChrome.dotGap,
            overflow: "hidden",
            opacity: chromeOpacity,
            borderBottom: chromeOpacity > 0.1 ? `1px solid ${windowChrome.containerBorder}` : "none",
          }}
        >
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficRed,
            }}
          />
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficYellow,
            }}
          />
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficGreen,
            }}
          />
        </div>

        {/* Content area */}
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/floating-screen.tsx
git commit -m "feat(video): add floating screen container with macOS chrome and zoom"
```

---

### Task 7: Logo Assembly component

**Files:**
- Create: `video/src/components/logo-assembly.tsx`

- [ ] **Step 1: Create the logo assembly component**

Create `video/src/components/logo-assembly.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, gradients, glows } from "../styles/theme";

interface LogoAssemblyProps {
  /** Frame when assembly animation starts */
  startFrame?: number;
}

// Deterministic particle start positions (spread around screen)
const LOGO_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const distance = 300 + (i % 3) * 150;
  return {
    startX: Math.cos(angle) * distance,
    startY: Math.sin(angle) * distance,
    size: 2 + (i % 4),
  };
});

export const LogoAssembly: React.FC<LogoAssemblyProps> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const assembleProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12 },
  });

  const logoOpacity = interpolate(assembleProgress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(assembleProgress, [0.8, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Converging particles */}
      {LOGO_PARTICLES.map((p, i) => {
        const x = p.startX * (1 - assembleProgress);
        const y = p.startY * (1 - assembleProgress);
        const particleOpacity = interpolate(assembleProgress, [0, 0.7], [0.8, 0], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: colors.cyan,
              opacity: particleOpacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Logo icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: gradients.cyanToTeal,
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoOpacity, [0, 1], [0.8, 1])})`,
          boxShadow: glowOpacity > 0.1 ? glows.cyan : "none",
        }}
      />

      {/* Brand name */}
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: "0.12em",
          backgroundImage: gradients.cyanToTeal,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoOpacity, [0, 1], [0.9, 1])})`,
        }}
      >
        MEDI-NEXUS
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/logo-assembly.tsx
git commit -m "feat(video): add logo assembly with converging particle animation"
```

---

### Task 8: Advantage Card component

**Files:**
- Create: `video/src/components/advantage-card.tsx`

- [ ] **Step 1: Create the advantage card component**

Create `video/src/components/advantage-card.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

type IconType = "stethoscope" | "routing" | "brain";

interface AdvantageCardProps {
  title: string;
  icon: IconType;
  startFrame: number;
}

const IconSvg: React.FC<{ type: IconType }> = ({ type }) => {
  const iconColor = colors.cyan;
  const size = 28;

  switch (type) {
    case "stethoscope":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M4.8 2.655A.5.5 0 015.3 2h2.4a.5.5 0 01.5.455V6.5a4 4 0 01-8 0V2.455A.5.5 0 01.7 2h2.4a.5.5 0 01.5.455V6.5a1.5 1.5 0 003 0V2.655zM6.5 12.5v1a4 4 0 004 4h1a2 2 0 002-2v-1"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            transform="translate(4, 2)"
          />
          <circle cx="17.5" cy="13.5" r="2" stroke={iconColor} strokeWidth="1.5" />
        </svg>
      );
    case "routing":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="18" r="3" stroke={iconColor} strokeWidth="1.5" />
          <path d="M9 6h6M18 9v6M6 9v3c0 3.314 2.686 6 6 6h3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M10 21h4M9 17v-3M15 17v-3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
          {/* Sparkle */}
          <circle cx="20" cy="4" r="1.5" fill={iconColor} opacity="0.6" />
          <line x1="20" y1="1" x2="20" y2="2" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="20" y1="6" x2="20" y2="7" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="17" y1="4" x2="18" y2="4" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="22" y1="4" x2="23" y2="4" stroke={iconColor} strokeWidth="1" opacity="0.6" />
        </svg>
      );
  }
};

export const AdvantageCard: React.FC<AdvantageCardProps> = ({
  title,
  icon,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14 },
  });

  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 30}px) scale(${scale})`,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "20px 28px",
        borderRadius: radius.xl,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
        minWidth: 380,
      }}
    >
      <IconSvg type={icon} />
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "0.05em",
          color: colors.foreground,
        }}
      >
        {title}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/components/advantage-card.tsx
git commit -m "feat(video): add advantage card component with icon variants"
```

---

### Task 9: Scene 1 — Logo Reveal

**Files:**
- Create: `video/src/scenes/logo-reveal.tsx`

- [ ] **Step 1: Create the logo reveal scene**

Create `video/src/scenes/logo-reveal.tsx`:

```tsx
import { useCurrentFrame } from "remotion";
import { colors } from "../styles/theme";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { fonts } from "../styles/theme";
import { PROMO_TAGLINE } from "../data/script";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

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
      {/* Logo assembles from particles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 10,
        }}
      >
        <LogoAssembly startFrame={15} />

        {/* Tagline typewriter */}
        {frame >= 70 && (
          <div
            style={{
              opacity: 1,
              marginTop: 8,
            }}
          >
            <Typewriter
              text={PROMO_TAGLINE}
              startFrame={75}
              charsPerFrame={1.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: "0.2em",
                color: colors.cyan,
                textShadow: "0 0 20px rgba(0,217,255,0.4)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/logo-reveal.tsx
git commit -m "feat(video): add Scene 1 logo reveal with particle assembly and tagline"
```

---

### Task 10: Scene 2 — Agent Intro

**Files:**
- Create: `video/src/scenes/agent-intro.tsx`

- [ ] **Step 1: Create the agent intro scene**

Create `video/src/scenes/agent-intro.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts } from "../styles/theme";
import { FadeSlide } from "../components/fade-slide";
import { AGENT_INTRO_HEADLINES, AGENT_INTRO_FEATURES } from "../data/script";

const FeatureIcon: React.FC<{ type: "stethoscope" | "routing" | "brain" }> = ({ type }) => {
  const iconColor = colors.cyan;
  switch (type) {
    case "stethoscope":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4.8 2.655A.5.5 0 015.3 2h2.4a.5.5 0 01.5.455V6.5a4 4 0 01-8 0V2.455A.5.5 0 01.7 2h2.4a.5.5 0 01.5.455V6.5a1.5 1.5 0 003 0V2.655zM6.5 12.5v1a4 4 0 004 4h1a2 2 0 002-2v-1" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" transform="translate(4, 2)" />
          <circle cx="17.5" cy="13.5" r="2" stroke={iconColor} strokeWidth="1.5" />
        </svg>
      );
    case "routing":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="18" r="3" stroke={iconColor} strokeWidth="1.5" />
          <path d="M8.5 8.5L15.5 15.5" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="4" r="1.5" fill={iconColor} opacity="0.6" />
        </svg>
      );
  }
};

export const AgentIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "ONE AGENT." appears at frame 0
  const line1Progress = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  // "EVERY WORKFLOW." appears at frame 30
  const line2Progress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12 },
  });

  // Both headlines fade out at frame 80
  const headlineFade = interpolate(frame, [80, 100], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Feature cascade starts at frame 100
  const featureStartFrame = 100;
  const featureDuration = 30; // frames per feature visible

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
      {/* Headlines */}
      {headlineFade > 0 && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            opacity: headlineFade,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.foreground,
              opacity: line1Progress,
              transform: `scale(${interpolate(line1Progress, [0, 1], [0.9, 1])})`,
            }}
          >
            {AGENT_INTRO_HEADLINES.line1}
          </span>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.foreground,
              opacity: line2Progress,
              transform: `scale(${interpolate(line2Progress, [0, 1], [0.9, 1])})`,
            }}
          >
            {AGENT_INTRO_HEADLINES.line2}
          </span>
        </div>
      )}

      {/* Feature cascade */}
      {frame >= featureStartFrame && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            zIndex: 10,
          }}
        >
          {AGENT_INTRO_FEATURES.map((feature, i) => {
            const featureStart = featureStartFrame + i * featureDuration;
            const featureEnd = featureStart + featureDuration;
            const isLastFeature = i === AGENT_INTRO_FEATURES.length - 1;

            // Fade in
            const fadeIn = interpolate(
              frame,
              [featureStart, featureStart + 10],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            // Fade out (except last feature which holds)
            const fadeOut = isLastFeature
              ? 1
              : interpolate(
                  frame,
                  [featureEnd - 5, featureEnd],
                  [1, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                );

            if (frame < featureStart) return null;
            if (!isLastFeature && frame > featureEnd + 5) return null;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: fadeIn * fadeOut,
                  transform: `translateY(${(1 - fadeIn) * 20}px)`,
                }}
              >
                <FeatureIcon type={feature.icon} />
                <span
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 32,
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    color: colors.foreground,
                  }}
                >
                  {feature.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/agent-intro.tsx
git commit -m "feat(video): add Scene 2 agent intro with headline and feature cascade"
```

---

### Task 11: Scene 3 — Patient Screening (intake in floating container)

**Files:**
- Create: `video/src/scenes/patient-screening.tsx`

This scene wraps the existing intake chat UI content inside a `<FloatingScreen>` container, then zooms into it.

- [ ] **Step 1: Create the patient screening scene**

Create `video/src/scenes/patient-screening.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FloatingScreen } from "../components/floating-screen";
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
  PROMO_CALLOUTS,
} from "../data/script";

const IntakeChatContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const triageFrame = 280;
  const triageScale = spring({
    frame: Math.max(0, frame - triageFrame),
    fps,
    config: { damping: 14 },
  });
  const triageBaseScale = interpolate(triageScale, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.2} />
      <ScanLineOverlay />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 48,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(to right, #00d9ff, #00b8a9)",
            }}
          />
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
          <span style={{ color: colors.mutedForeground, fontSize: 12 }}>
            / Patient Intake
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <MessageBubble role="user" text={INTAKE_MESSAGES.userMessage} startFrame={30} />
        <MessageBubble
          role="assistant"
          text={INTAKE_MESSAGES.aiMessage}
          startFrame={50}
          typewriter
          charsPerFrame={2}
        />

        {/* Form */}
        <FadeSlide startFrame={140} direction="up" distance={15}>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: 16,
              backgroundColor: colors.card,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {INTAKE_FORM.fields.map((field, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {field.label}
                </span>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.muted,
                    fontSize: 13,
                    color: colors.foreground,
                    fontFamily: fonts.body,
                  }}
                >
                  <Typewriter text={field.value} startFrame={155 + i * 20} charsPerFrame={1.5} />
                </div>
              </div>
            ))}
          </div>
        </FadeSlide>

        {/* Triage card */}
        {frame >= triageFrame && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                borderRadius: radius["2xl"],
                border: "1px solid rgba(16,185,129,0.3)",
                backgroundColor: "rgba(16,185,129,0.05)",
                padding: 14,
                opacity: triageScale,
                transform: `scale(${triageBaseScale})`,
                boxShadow: triageScale > 0.5 ? glows.emerald : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#34d399", fontFamily: fonts.body }}>
                  Check-in Complete
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: colors.mutedForeground }}>Directed to</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.department}
                </span>
              </div>
              <span style={{ fontSize: 11, color: colors.mutedForeground }}>
                {TRIAGE_RESULT.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const PatientScreening: React.FC = () => {
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
      {/* Feature title */}
      <FeatureCallout
        text={PROMO_CALLOUTS.patientScreening}
        position="top-center"
        startFrame={10}
        endFrame={40}
      />

      {/* Floating container with intake chat */}
      <FloatingScreen
        enterFrame={5}
        zoomInFrame={200}
        enterFrom="bottom"
        widthPercent={70}
      >
        <IntakeChatContent />
      </FloatingScreen>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/patient-screening.tsx
git commit -m "feat(video): add Scene 3 patient screening with floating container and zoom"
```

---

### Task 12: Scene 4 — Routing and Support (doctor workspace + AI panel)

**Files:**
- Create: `video/src/scenes/routing-and-support.tsx`

This is the longest scene (600 frames). It shows two floating containers side by side (handoff), then transitions to doctor workspace, then zooms into the AI panel.

- [ ] **Step 1: Create the routing and support scene**

Create `video/src/scenes/routing-and-support.tsx`:

```tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FloatingScreen } from "../components/floating-screen";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import {
  PATIENT_LIST,
  VISIT_BRIEF,
  ORDERS,
  SOAP_NOTE,
  AI_TOOL_CALLS,
  AI_RESPONSE,
  PROMO_CALLOUTS,
} from "../data/script";

const URGENCY_COLORS = {
  critical: "#ef4444",
  urgent: "#f59e0b",
  routine: "#10b981",
} as const;

const DoctorWorkspaceContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelProgress = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 12 },
  });

  // AI panel tool calls and response (later in scene)
  const aiSectionStart = 200;
  const toolStartFrame = aiSectionStart + 20;

  const buttonGlowOpacity =
    frame > aiSectionStart + 180
      ? 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI)
      : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          backgroundColor: colors.card,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 12,
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
              padding: "4px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.muted,
              color: colors.mutedForeground,
              fontSize: 11,
              fontFamily: fonts.body,
              width: 200,
            }}
          >
            Search patients...
          </div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: colors.muted,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: colors.mutedForeground,
            fontFamily: fonts.display,
          }}
        >
          DR
        </div>
      </div>

      {/* 3-Zone Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Zone A: Patient List */}
        <div
          style={{
            width: 200,
            borderRight: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * -200}px)`,
            opacity: panelProgress,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 10,
              letterSpacing: "0.1em",
              color: colors.mutedForeground,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            My Patients
          </span>
          {PATIENT_LIST.map((patient, i) => (
            <FadeSlide key={i} startFrame={15 + i * 6} direction="left" distance={12}>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${"selected" in patient && patient.selected ? "rgba(0,217,255,0.3)" : "transparent"}`,
                  backgroundColor: "selected" in patient && patient.selected ? "rgba(0,217,255,0.1)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: URGENCY_COLORS[patient.urgency],
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500, color: colors.foreground, fontFamily: fonts.body, flex: 1 }}>
                    {patient.name}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: colors.mutedForeground, paddingLeft: 12 }}>
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
            padding: 14,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Patient card */}
          <FadeSlide startFrame={25} direction="up" distance={12}>
            <div
              style={{
                padding: 12,
                borderRadius: radius.lg,
                border: "1px solid rgba(0,217,255,0.2)",
                backgroundColor: colors.card,
                boxShadow: frame > 35 ? glows.cyan : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>Sarah Chen</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 999,
                      backgroundColor: "rgba(245,158,11,0.15)",
                      color: colors.amber,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    URGENT
                  </span>
                </div>
                <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body }}>
                  42F — Chief Complaint: Chest pain
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 10, color: colors.mutedForeground }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>128/82</div>
                  <div>BP</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>92</div>
                  <div>HR</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>98%</div>
                  <div>SpO2</div>
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* Brief + Orders */}
          <div style={{ display: "flex", gap: 12, flex: 1 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <FadeSlide startFrame={50} direction="up" distance={12}>
                <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground, display: "block", marginBottom: 6 }}>Pre-Visit Brief</span>
                  <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.5 }}>
                    <Typewriter text={VISIT_BRIEF} startFrame={60} charsPerFrame={3} />
                  </div>
                </div>
              </FadeSlide>

              <FadeSlide startFrame={70} direction="up" distance={12}>
                <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground, display: "block", marginBottom: 6 }}>Orders</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {ORDERS.map((order, i) => (
                      <FadeSlide key={i} startFrame={80 + i * 3} direction="up" distance={8}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: radius.md, backgroundColor: colors.muted }}>
                          <span style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 6px",
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

            {/* Notes */}
            <FadeSlide startFrame={90} direction="up" distance={12} style={{ flex: 1 }}>
              <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground }}>Clinical Notes</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, backgroundColor: "rgba(99,102,241,0.15)", color: colors.purple, marginLeft: "auto" }}>AI Draft</span>
                </div>
                <div style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.mono, lineHeight: 1.6, whiteSpace: "pre-wrap", padding: 10, borderRadius: radius.md, backgroundColor: colors.muted, minHeight: 120 }}>
                  <Typewriter text={SOAP_NOTE} startFrame={100} charsPerFrame={2} />
                </div>
              </div>
            </FadeSlide>
          </div>
        </div>

        {/* Zone C: AI Panel */}
        <div
          style={{
            width: 260,
            borderLeft: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * 260}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground }}>AI Assistant</span>
          </div>

          {/* Tool calls */}
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Doctor question */}
            {frame >= aiSectionStart && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius["2xl"],
                    borderBottomRightRadius: 4,
                    backgroundColor: "rgba(0,217,255,0.15)",
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.body,
                    maxWidth: "80%",
                  }}
                >
                  Review labs and recommend next steps
                </div>
              </div>
            )}

            {/* Tool calls cascade */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {AI_TOOL_CALLS.map((tool, i) => {
                const toolFrame = toolStartFrame + i * 10;
                const toolProgress = spring({
                  frame: Math.max(0, frame - toolFrame),
                  fps,
                  config: { damping: 14 },
                });
                const isCompleted = frame >= toolFrame + 15;

                if (frame < toolFrame) return null;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px",
                      borderRadius: radius.md,
                      backgroundColor: colors.muted,
                      opacity: toolProgress,
                      transform: `translateY(${(1 - toolProgress) * 10}px)`,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: 10, color: colors.foreground, fontFamily: fonts.mono, flex: 1 }}>
                      {tool.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        borderRadius: 999,
                        backgroundColor: isCompleted ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                        color: isCompleted ? colors.green : colors.amber,
                        fontWeight: 500,
                      }}
                    >
                      {isCompleted ? "done" : "running"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Response */}
            {frame >= toolStartFrame + 60 && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius["2xl"],
                    borderBottomLeftRadius: 4,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.body,
                    lineHeight: 1.5,
                    maxWidth: "90%",
                  }}
                >
                  <Typewriter text={AI_RESPONSE} startFrame={toolStartFrame + 65} charsPerFrame={2} />
                </div>
              </div>
            )}

            {/* Place Order button */}
            {frame >= toolStartFrame + 140 && (
              <FadeSlide startFrame={toolStartFrame + 140} direction="up" distance={8}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      padding: "6px 14px",
                      borderRadius: radius.md,
                      background: "linear-gradient(to right, #00d9ff, #00b8a9)",
                      color: colors.white,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: fonts.body,
                      boxShadow: `0 0 ${20 * buttonGlowOpacity}px rgba(0,217,255,${0.3 * buttonGlowOpacity})`,
                    }}
                  >
                    Place Order
                  </div>
                </div>
              </FadeSlide>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoutingAndSupport: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Handoff: intake container visible frames 0-60, fades out
  const intakeFade = interpolate(frame, [40, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Doctor workspace container enters at frame 0, expands at frame 60
  const doctorEnterProgress = spring({
    frame,
    fps,
    config: { damping: 14 },
  });

  // After intake fades, doctor container moves to center
  const doctorOffsetX = interpolate(frame, [0, 60], [150, 0], {
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
        backgroundColor: colors.background,
      }}
    >
      {/* Feature title */}
      <FeatureCallout
        text={PROMO_CALLOUTS.routingSupport}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      {/* Intake container (left, fading out) — handoff moment */}
      {intakeFade > 0 && (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: "50%",
            transform: `translateY(-50%) scale(${0.4 * doctorEnterProgress})`,
            opacity: intakeFade * doctorEnterProgress,
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 500,
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 15px 40px rgba(0,0,0,0.4)",
              backgroundColor: colors.card,
            }}
          >
            <div
              style={{
                height: 28,
                backgroundColor: "rgba(255,255,255,0.03)",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                gap: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#27C93F" }} />
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: "linear-gradient(to right, #00d9ff, #00b8a9)" }} />
                <span style={{ fontFamily: fonts.display, fontSize: 10, fontWeight: 700, color: colors.cyan }}>INTAKE</span>
              </div>
              <div style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", backgroundColor: "rgba(16,185,129,0.05)" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#34d399" }}>Directed to: Cardiology</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doctor workspace floating container */}
      <FloatingScreen
        enterFrame={0}
        zoomInFrame={80}
        enterFrom="right"
        widthPercent={75}
      >
        <DoctorWorkspaceContent />
      </FloatingScreen>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/routing-and-support.tsx
git commit -m "feat(video): add Scene 4 routing and support with handoff and workspace"
```

---

### Task 13: Scene 5 — Agent Advantages

**Files:**
- Create: `video/src/scenes/agent-advantages.tsx`

- [ ] **Step 1: Create the agent advantages scene**

Create `video/src/scenes/agent-advantages.tsx`:

```tsx
import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";
import { AdvantageCard } from "../components/advantage-card";
import { AGENT_ADVANTAGES } from "../data/script";

export const AgentAdvantages: React.FC = () => {
  const frame = useCurrentFrame();

  // All cards fade out together near the end
  const fadeOut = interpolate(frame, [250, 280], [1, 0], {
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
        backgroundColor: colors.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: fadeOut,
          zIndex: 10,
        }}
      >
        {AGENT_ADVANTAGES.map((advantage, i) => (
          <AdvantageCard
            key={i}
            title={advantage.title}
            icon={advantage.icon}
            startFrame={30 + i * 20}
          />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/agent-advantages.tsx
git commit -m "feat(video): add Scene 5 agent advantages with staggered cards"
```

---

### Task 14: Scene 6 — Closing CTA

**Files:**
- Create: `video/src/scenes/closing-cta.tsx`

- [ ] **Step 1: Create the closing CTA scene**

Create `video/src/scenes/closing-cta.tsx`:

```tsx
import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles/theme";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { PROMO_CLOSING_TAGLINE } from "../data/script";

export const ClosingCta: React.FC = () => {
  const frame = useCurrentFrame();

  // Cyan glow pulse behind logo
  const glowPulse = 0.3 + 0.2 * Math.sin((frame / 20) * Math.PI);

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
      {/* Glow behind logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,217,255,${glowPulse * 0.15}) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          zIndex: 10,
        }}
      >
        <LogoAssembly startFrame={10} />

        {/* Tagline */}
        {frame >= 60 && (
          <div style={{ marginTop: 8 }}>
            <Typewriter
              text={PROMO_CLOSING_TAGLINE}
              startFrame={65}
              charsPerFrame={1.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: colors.cyan,
                textShadow: "0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(0,217,255,0.2)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add video/src/scenes/closing-cta.tsx
git commit -m "feat(video): add Scene 6 closing CTA with logo assembly and tagline"
```

---

### Task 15: Wire up DemoVideo.tsx and Root.tsx

**Files:**
- Modify: `video/src/DemoVideo.tsx`
- Modify: `video/src/Root.tsx`

- [ ] **Step 1: Replace DemoVideo.tsx with new scene composition**

Replace the entire contents of `video/src/DemoVideo.tsx` with:

```tsx
import { Series } from "remotion";
import { BRollLayer } from "./components/b-roll-layer";
import { LogoReveal } from "./scenes/logo-reveal";
import { AgentIntro } from "./scenes/agent-intro";
import { PatientScreening } from "./scenes/patient-screening";
import { RoutingAndSupport } from "./scenes/routing-and-support";
import { AgentAdvantages } from "./scenes/agent-advantages";
import { ClosingCta } from "./scenes/closing-cta";

// Scene durations in frames (30fps)
// Scene 1: 0-150      (5s)   Logo Reveal
// Scene 2: 150-360    (7s)   Agent Intro
// Scene 3: 360-840    (16s)  Patient Screening
// Scene 4: 840-1440   (20s)  Routing & Support
// Scene 5: 1440-1740  (10s)  Agent Advantages
// Scene 6: 1740-1950  (7s)   Closing CTA
// Total: 1950 frames = 65s

const SCENE_DURATIONS = {
  logoReveal: 150,
  agentIntro: 210,
  patientScreening: 480,
  routingAndSupport: 600,
  agentAdvantages: 300,
  closingCta: 210,
} as const;

// B-roll opacity keyframes (absolute frames):
// High during brand scenes, low during UI demos
const B_ROLL_KEYFRAMES: [number, number][] = [
  [0, 0.4],        // Scene 1: brand intro — high
  [150, 0.35],     // Scene 2: agent intro — medium-high
  [360, 0.12],     // Scene 3: UI demo — low
  [840, 0.12],     // Scene 4: UI demo — low
  [1440, 0.4],     // Scene 5: advantages — high
  [1740, 0.35],    // Scene 6: closing — medium-high
  [1950, 0.3],     // End
];

export const DemoVideo: React.FC = () => {
  return (
    <div style={{ position: "relative", width: 1920, height: 1080 }}>
      {/* Persistent b-roll behind everything */}
      <BRollLayer opacityKeyframes={B_ROLL_KEYFRAMES} />

      {/* Scene sequence */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <Series>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.logoReveal}>
            <LogoReveal />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.agentIntro}>
            <AgentIntro />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.patientScreening}>
            <PatientScreening />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.routingAndSupport}>
            <RoutingAndSupport />
          </Series.Sequence>
          <Series.Sequence durationInFrames={SCENE_DURATIONS.agentAdvantages}>
            <AgentAdvantages />
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

- [ ] **Step 2: Update Root.tsx duration**

In `video/src/Root.tsx`, change `durationInFrames={1200}` to `durationInFrames={1950}`:

```tsx
import { Composition, registerRoot, staticFile } from "remotion";
import { DemoVideo } from "./DemoVideo";

const fontStyles = [
  "@font-face {",
  "  font-family: 'JetBrains Mono';",
  `  src: url('${staticFile("fonts/JetBrainsMono-VariableFont_wght.ttf")}') format('truetype');`,
  "  font-weight: 100 800;",
  "  font-display: block;",
  "}",
].join("\n");

const RemotionRoot: React.FC = () => {
  return (
    <>
      <style>{fontStyles}</style>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={1950}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
```

- [ ] **Step 3: Verify full project compiles**

Run: `cd video && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Launch Remotion Studio and verify all scenes render**

Run: `cd video && npx remotion studio src/Root.tsx`
Expected: Studio opens at `http://localhost:3000`. Scrub through timeline — all 6 scenes should render without errors. Total duration should show 65s / 1950 frames.

- [ ] **Step 5: Commit**

```bash
git add video/src/DemoVideo.tsx video/src/Root.tsx
git commit -m "feat(video): wire up all 6 promo scenes with b-roll layer (65s / 1950 frames)"
```

---

### Task 16: Visual polish pass

After all scenes render, do a visual scrub of the full timeline and fix any issues.

**Files:**
- Modify: Any scene or component files as needed

- [ ] **Step 1: Scrub through full timeline in Remotion Studio**

Run: `cd video && npx remotion studio src/Root.tsx`

Check each scene for:
- Smooth transitions between scenes (no jarring cuts)
- B-roll visible at correct opacity levels
- Floating containers entrance/exit smooth
- Typewriter timing feels right (not too fast/slow)
- Feature callouts visible and readable
- All text rendering with JetBrains Mono
- No overlapping elements or z-index issues

- [ ] **Step 2: Fix any timing or visual issues found**

Adjust frame numbers, opacity values, or spring configs as needed in the relevant files.

- [ ] **Step 3: Verify fixes**

Re-scrub the timeline to confirm fixes look correct.

- [ ] **Step 4: Commit**

```bash
git add -u video/src/
git commit -m "fix(video): visual polish pass — timing and transition adjustments"
```
