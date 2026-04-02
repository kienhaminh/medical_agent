# Remotion Demo Video — Design Spec

## Overview

A 40-second polished marketing demo video for the MediNexus medical agent platform, built with Remotion. The video follows a single patient journey from intake to resolution using a cinematic zoom approach with smooth, clinical transitions.

**Audience:** General marketing (website/social media)
**Duration:** ~40 seconds (1200 frames @ 30fps)
**Resolution:** 1920 × 1080 (Full HD)
**Style:** Live product walkthrough — UI animating in, messages typing, panels opening
**Pacing:** Smooth, clinical, elegant transitions
**Framework:** Remotion v4

## Scene Breakdown

### Scene 1: Opening — Intake Portal (0s – 4s, frames 0–120)

Dark background fades in with dot-matrix pattern + scan-line animation. The MEDI-NEXUS logo glows into view (cyan→teal gradient text). The "RECEPTION AI ONLINE" pill badge pulses. Four suggestion cards fade in staggered.

**Feature callout:** "Your AI-Powered Hospital" — bottom center, fades in with logo.

**Elements:**
- Dot-matrix background (radial-gradient cyan dots, 20px grid)
- Scan-line sweep (cyan gradient, continuous)
- MEDI-NEXUS logo (JetBrains Mono, bold, gradient text from-cyan-500 to-teal-500)
- "RECEPTION AI ONLINE" badge (cyan border, pulse dot)
- 4 suggestion cards ("I'd like to check in...", "I'm experiencing chest pain", "I need to see a doctor today", "This is my first time here")
- Animated cursor clicks "I'm experiencing chest pain"

**Animation:**
- Background opacity 0→1 over 15 frames
- Scan-line runs continuously (3s cycle)
- Logo uses `spring({damping: 12})` bounce-in
- Cards stagger with 5-frame delay each, slide-up + fade
- Cursor appears at frame 90, clicks at frame 110

### Scene 2: AI Intake Conversation (4s – 14s, frames 120–420)

User message bubble slides in. AI response types character-by-character. A form appears with patient info fields that auto-fill. After form submission, triage "Check-in Complete" card animates in with emerald glow and department routing.

**Feature callout:** "Patients Triaged in Seconds" — top-right corner, appears after triage card.

**Elements:**
- User bubble (bg-cyan-500/15, rounded-2xl, rounded-br-sm): "I'm experiencing chest pain"
- AI bubble (bg-muted/60, rounded-2xl, rounded-bl-sm) with typewriter: "I'm sorry to hear that. Let me help you get checked in right away. Can you tell me when the pain started and how severe it is on a scale of 1-10?"
- Form fields: Name → "Sarah Chen", DOB → "03/15/1985", Symptoms → "Chest pain, shortness of breath"
- Triage card: emerald border + glow, CheckCircle2 icon, "Directed to: Cardiology", "A medical team will see you shortly"

**Animation:**
- User message slides in from right (spring, 12 frames)
- AI typewriter at ~2 chars/frame (40 chars/sec)
- Form fades in as a group, values type in sequentially
- Triage card scales from 0.95→1.0 with emerald box-shadow fade-in
- Crossfade transition to Scene 3 (200ms overlap)

### Scene 3: Doctor Clinical Workspace (14s – 26s, frames 420–780)

The 3-zone layout assembles from edges. Patient list (Zone A) slides from left, clinical workspace (Zone B) expands from center, AI panel (Zone C) slides from right. Patient data populates, pre-visit brief types in, orders cascade, SOAP note drafted by AI.

**Feature callout:** "Everything Your Team Needs, One Screen" — top center, appears after panels assemble.

**Elements:**
- Header: search bar + notification bell
- Zone A (w-60): Patient list with urgency dots
  - Sarah Chen (amber/urgent, selected with cyan highlight)
  - 3 other patients (green/routine dots)
- Zone B (flex-1): Clinical workspace with collapsible panels
  - Patient card: name, age, chief complaint, vitals
  - Pre-visit brief: "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history."
  - Orders panel: "Troponin I" (Lab), "12-Lead ECG" (Lab), "Chest X-Ray" (Imaging)
  - Clinical notes: SOAP note "S: Patient reports substernal chest pain 7/10..."
- Zone C: AI panel with Insights/Chat tabs, sparkle icon

**Animation:**
- 3 panels slide simultaneously (400ms ease-out via spring)
  - Left: translateX(-100%) → 0
  - Right: translateX(100%) → 0
  - Center: scaleX(0.8) → 1.0
- Patient card highlight: cyan border + glow transition
- Collapsible panels open sequentially (brief → orders → notes) with 20-frame gaps
- Orders rows cascade in (100ms / 3-frame stagger)
- SOAP note typewriter in editor

### Scene 4: AI Agent Reasoning (26s – 34s, frames 780–1020)

Camera zooms into the AI panel (Zone C). Shows agent processing: thinking indicator pulses, tool calls cascade, then AI response types out with medical recommendations.

**Feature callout:** "AI That Thinks With Your Doctors" — bottom-left, appears after tool calls complete.

**Elements:**
- AI chat panel (zoomed to fill screen)
- Thinking progress indicator (pulsing dots)
- Tool call items with icons + status badges:
  - `search_patient_records` → completed
  - `check_drug_interactions` → completed
  - `analyze_lab_results` → completed
- Agent response: "Based on the elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy."
- "Place Order" action button with cyan glow

**Animation:**
- Workspace scales to 1.3x, translates to center on AI panel (spring, 600ms)
- Thinking dots: looping opacity 0.3→1.0
- Tool calls slide-in from bottom with 10-frame stagger, status badge animates pending→completed
- Response typewriter at ~2 chars/frame
- Button glow pulse (cyan box-shadow animation)

### Scene 5: Resolution + Closing (34s – 40s, frames 1020–1200)

Camera zooms back out to full workspace. Discharge button is clicked — success state ripples. UI fades to dark. MEDI-NEXUS logo + tagline fades in at center.

**Feature callout / tagline:** "The Future of Patient Care" — below logo, serves as closing tagline.

**Elements:**
- Quick actions bar with "Discharge" button
- Success ripple (emerald pulse from button)
- MEDI-NEXUS logo (large, centered)
- Tagline text below logo
- Dot-matrix background returns subtly

**Animation:**
- Zoom back out: scale 1.3→1.0 (spring, 600ms)
- Discharge button click → emerald pulse ripple
- Workspace fades to black (800ms / 24 frames)
- Logo scales up with `spring({damping: 15})` + cyan glow
- Tagline fades in 15 frames after logo settles
- Final 20 frames hold on logo

## Project Architecture

```
video/
├── package.json
├── tsconfig.json
├── src/
│   ├── Root.tsx                    # Remotion root — registers composition
│   ├── DemoVideo.tsx               # Main composition — sequences all scenes
│   ├── scenes/
│   │   ├── opening.tsx             # Scene 1: Logo + intake portal
│   │   ├── intake-chat.tsx         # Scene 2: AI conversation + triage
│   │   ├── doctor-workspace.tsx    # Scene 3: 3-zone clinical layout
│   │   ├── ai-reasoning.tsx        # Scene 4: Agent tool calls + response
│   │   └── closing.tsx             # Scene 5: Discharge + logo tagline
│   ├── components/
│   │   ├── typewriter.tsx          # Reusable typewriter text animation
│   │   ├── message-bubble.tsx      # Chat bubble (user/AI variants)
│   │   ├── scan-line.tsx           # Animated scan-line overlay
│   │   ├── dot-matrix.tsx          # Dot-matrix background
│   │   ├── medical-glow.tsx        # Glow effect wrapper
│   │   ├── cursor.tsx              # Animated click cursor
│   │   └── fade-slide.tsx          # Reusable fade+slide entrance
│   ├── styles/
│   │   └── theme.ts               # Color tokens, fonts, spacing
│   └── data/
│       └── script.ts              # All demo text content
```

**Key decisions:**
- Self-contained in `video/` — no shared code with `web/`. UI elements recreated as simpler Remotion-native components.
- Theme file mirrors `web/app/globals.css` tokens exactly (oklch converted to hex/rgba for inline styles).
- Scene data centralized in `script.ts` for easy content tweaks.

## Theme Tokens

Mapped from the project's Clinical Futurism dark theme:

| Token | CSS Value | Video Value |
|-------|-----------|-------------|
| background | oklch(0.09 0 0) | #141414 |
| foreground | oklch(0.95 0 0) | #f0f0f0 |
| card | oklch(0.11 0 0) | #1a1a1a |
| border | oklch(0.2 0 0) | #303030 |
| muted | oklch(0.16 0 0) | #242424 |
| muted-foreground | oklch(0.65 0 0) | #999999 |
| cyan-electric | #00d9ff | #00d9ff |
| teal-medical | #00b8a9 | #00b8a9 |
| purple-medical | #6366f1 | #6366f1 |
| green-medical | #10b981 | #10b981 |
| navy-deep | #0a0e27 | #0a0e27 |

**Fonts:** JetBrains Mono (display/headings), Geist Sans (body), Geist Mono (code)

**Glow effects (box-shadow):**
- Cyan: `0 0 20px rgba(0,217,255,0.3), 0 0 40px rgba(0,217,255,0.1)`
- Teal: `0 0 15px rgba(0,184,169,0.3), 0 0 30px rgba(0,184,169,0.1)`
- Emerald: `0 0 15px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.1)`

## Animation System

- **Easing:** All motion uses Remotion `spring()` with `{fps: 30, damping: 12-15}` — smooth, professional, no bounce or linear.
- **Transitions:** Crossfade between scenes (6-frame / 200ms overlap).
- **Typewriter:** Frame-based character reveal: `text.slice(0, Math.floor(charsPerFrame * frame))` at ~2 chars/frame.
- **Stagger:** Sequential element entrance with configurable frame delay (typically 3-5 frames between items).
- **Zoom:** Scale + translate transforms via `interpolate()` for camera movement between scenes 3↔4↔5.

## Feature Callout Labels

Overlaid text during each scene. Style: JetBrains Mono, uppercase, `letter-spacing: 0.15em`, subtle cyan text-shadow, fade-in + slide-up entrance (spring easing). Appears ~30 frames into each scene, holds for scene duration, fades during transition.

| Scene | Label | Position |
|-------|-------|----------|
| 1 | "Your AI-Powered Hospital" | Bottom center |
| 2 | "Patients Triaged in Seconds" | Top-right |
| 3 | "Everything Your Team Needs, One Screen" | Top center |
| 4 | "AI That Thinks With Your Doctors" | Bottom-left |
| 5 | "The Future of Patient Care" | Center, below logo |

## Demo Script Content

**Scene 2 — Intake:**
- User message: "I'm experiencing chest pain"
- AI message: "I'm sorry to hear that. Let me help you get checked in right away. Can you tell me when the pain started and how severe it is on a scale of 1-10?"
- Form: Name "Sarah Chen", DOB "03/15/1985", Symptoms "Chest pain, shortness of breath"
- Triage: Directed to Cardiology, urgency Urgent

**Scene 3 — Doctor workspace:**
- Patients: Sarah Chen (urgent), James Wilson (routine), Maria Garcia (routine), Robert Kim (routine)
- Brief: "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history."
- Orders: Troponin I (Lab), 12-Lead ECG (Lab), Chest X-Ray (Imaging)
- SOAP: "S: Patient reports substernal chest pain rated 7/10, onset 2 hours ago..."

**Scene 4 — AI reasoning:**
- Tool calls: search_patient_records, check_drug_interactions, analyze_lab_results
- Response: "Based on the elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy."
