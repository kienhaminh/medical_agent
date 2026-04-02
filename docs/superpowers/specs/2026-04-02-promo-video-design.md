# MediNexus Promotion Video — Design Spec

## Overview

A 65-second cinematic promotion video for the MediNexus medical agent platform, built with Remotion. The narrative centers on the AI agent as the hero — every feature is framed as a capability of the agent. The video opens with brand identity, introduces the agent concept, demonstrates it in action via real UI screens, highlights key advantages, and closes with a strong brand statement.

**Audience:** General marketing (website, social media, investor decks)
**Duration:** ~65 seconds (1950 frames @ 30fps)
**Resolution:** 1920 x 1080 (Full HD)
**Style:** Cinematic promotion with abstract medical b-roll + real UI demo screens
**Pacing:** Smooth, clinical, elegant
**Framework:** Remotion v4
**Narrative:** "The Agent That Runs Your Hospital" — agent-centric, feature-driven

---

## Narrative Arc

Every section focuses on what the AI agent does. The agent is the hero — features are its capabilities. No metrics, no stat numbers — just feature advantages and agent capabilities.

---

## Scene Breakdown

### Scene 1: Logo Reveal — Brand Intro (0s–5s, frames 0–150)

Black screen. Abstract medical b-roll fades in — floating DNA helix (cyan wireframe, 3D rotation), pulse wave lines (ECG-style, animated), subtle particle network (nodes + connecting lines). All in cyan/teal on dark background.

Through the particles, the MEDI-NEXUS logo assembles (particles converge into logo shape from edges). Tagline types below: **"Intelligent Healthcare, Automated"**

**Visual Elements:**
- DNA helix floating (3D rotation, cyan wireframe, semi-transparent)
- Pulse wave (ECG-style line, animated draw)
- Particle network (~40-60 nodes with connecting lines, slow drift)
- Logo assembles from converging particles
- Tagline typewriter below logo

**B-Roll Effects:**
- Slow parallax movement on all elements
- Depth-of-field: background particles slightly blurred and dimmer
- Subtle light rays from logo center
- Smooth fade transition to next scene

---

### Scene 2: Introducing the Agent (5s–12s, frames 150–360)

Text appears large and cinematic: **"ONE AGENT."** (pause) **"EVERY WORKFLOW."**

B-roll particles reorganize into a brain/neural network shape. Feature titles cascade in one at a time, each with a subtle icon:

- "Screens patients automatically" (stethoscope icon)
- "Routes to the right department" (routing arrows icon)
- "Assists doctors in real-time" (brain/sparkle icon)

Each title appears with a fade-slide entrance and fades out as the next appears.

**Animation:**
- "ONE AGENT." scales in with spring easing, holds 1s
- "EVERY WORKFLOW." fades in below, holds 1s
- Both fade out, feature titles cascade with 1.5s per title
- Particle network subtly morphs behind text

---

### Scene 3: Agent Screens Patients (12s–28s, frames 360–840)

Feature title fades in top-left with cyan glow: **"AUTOMATIC PATIENT SCREENING"**

A floating browser container slides up from below frame with spring easing. Inside it: the **intake chat UI** — messages typing, form auto-filling, triage card appearing.

Camera slowly zooms into the container, transitioning from framed view to immersive full-screen view of the chat. The triage card with "Directed to: Cardiology" gets a spotlight zoom.

**Floating Container:**
- macOS-style window chrome: title bar with traffic light dots (red #FF5F57, yellow #FFBD2E, green #27C93F)
- Rounded top corners (~12px radius)
- Dark background matching theme (#1a1a1a)
- Large soft drop shadow: `0 25px 60px rgba(0,0,0,0.5)`
- Subtle border: `1px solid rgba(255,255,255,0.08)`
- No 3D rotation — flat but elevated via shadow
- ~75% of frame width, centered

**Animation Flow:**
1. Container slides up from below frame (spring easing)
2. Chat messages type inside the container
3. Form fields auto-fill sequentially
4. Triage card appears with emerald glow
5. Smooth zoom through container into full-screen (chrome fades out as content fills frame)
6. Triage card gets spotlight zoom + glow

**UI Fidelity:**
- Exact intake page layout (header, messages, form)
- Dot-matrix bg + scan-line inside screen
- User/AI bubbles match actual styles
- Emerald triage card exact match

**Demo Content (intake):**
- User message: "I'm experiencing chest pain"
- AI message: "I'm sorry to hear that. Let me help you get checked in right away. Can you tell me when the pain started and how severe it is on a scale of 1-10?"
- Form: Name "Sarah Chen", DOB "03/15/1985", Symptoms "Chest pain, shortness of breath"
- Triage: Directed to Cardiology, urgency Urgent

---

### Scene 4: Agent Routes & Assists (28s–48s, frames 840–1440)

Camera zooms back out from intake screen (content shrinks back into floating container). Feature title transitions: **"INTELLIGENT ROUTING & CLINICAL SUPPORT"**

A second floating container slides in from the left showing the **doctor workspace**. The two containers sit side by side briefly (showing the handoff), then the intake one fades and the doctor workspace container expands to center.

Camera zooms in — the 3-zone layout animates: patient list, clinical panels open, AI panel shows tool calls + reasoning. SOAP note types in.

Then camera zooms further into the **AI panel** — tool calls cascade, agent response types out. "Place Order" button glows.

**Animation Flow:**
1. Zoom out from intake → back into floating container
2. Two containers side by side (handoff moment, ~2s)
3. Intake container fades, doctor workspace expands center
4. Zoom into doctor workspace → 3 zones build
5. Deeper zoom into AI panel
6. Tool calls + response typewriter

**UI Fidelity (Doctor Workspace):**
- Exact 3-zone layout (patient list | clinical panels | AI panel)
- Patient list with urgency dots (Sarah Chen amber/urgent, others green/routine)
- Collapsible panels (brief, orders, notes)
- AI panel with tool call items + status badges
- SOAP note typewriter in editor

**UI Fidelity (AI Panel):**
- Thinking progress indicator (pulsing dots)
- Tool calls: `search_patient_records` completed, `check_drug_interactions` completed, `analyze_lab_results` completed
- Agent response: "Based on the elevated troponin and ECG findings, recommend cardiology consult for possible ACS workup. Consider starting dual antiplatelet therapy."
- "Place Order" action button with cyan glow

**Demo Content (doctor workspace):**
- Patients: Sarah Chen (urgent), James Wilson (routine), Maria Garcia (routine), Robert Kim (routine)
- Brief: "42F presenting with acute chest pain and dyspnea. Onset 2 hours ago. Pain: 7/10, substernal, non-radiating. No prior cardiac history."
- Orders: Troponin I (Lab), 12-Lead ECG (Lab), Chest X-Ray (Imaging)
- SOAP: "S: Patient reports substernal chest pain rated 7/10, onset 2 hours ago..."

---

### Scene 5: Agent Advantages (48s–58s, frames 1440–1740)

Camera zooms all the way out. Floating containers fade. B-roll returns — particles, DNA, pulse waves come forward (opacity increases to ~0.4).

Three advantage cards appear one by one with staggered spring animations:

- **"Automated Patient Screening"** — stethoscope icon, hands-free intake
- **"Intelligent Department Routing"** — routing arrows icon, agent directs patients
- **"Real-Time Clinical Support"** — brain/sparkle icon, agent assists doctors

**Card Style:**
- Dark glass background: `rgba(255,255,255,0.05)`
- Subtle border: `1px solid rgba(255,255,255,0.1)`
- Small icon left-aligned, feature name right
- Same shadow treatment as floating containers but smaller
- Cards float in the particle field

**Animation:**
- Cards appear one by one with staggered spring slide-up (15-frame gap)
- Subtle scale 0.95 -> 1.0 on entrance
- Hold all three visible for ~2s
- All fade out together with slight scale-down

---

### Scene 6: Closing CTA (58s–65s, frames 1740–1950)

Advantage cards fade out. MEDI-NEXUS logo assembles center-screen (particles converge into logo shape, mirroring Scene 1). Tagline types below: **"THE FUTURE OF PATIENT CARE"**

Subtle cyan glow pulses behind the logo. All b-roll particles slowly settle into stillness. Hold on logo for 3-4 seconds.

**Animation:**
- Particles converge into logo shape (reverse of Scene 1 dispersal)
- Logo scales up with spring easing + cyan glow
- Tagline typewriter below logo (15 frames after logo settles)
- Glow pulses gently 2-3 times
- Final 90 frames (3s) hold on logo

---

## B-Roll & Particle System

Persistent background layer rendered behind all scene content. Opacity varies per act.

### Particle Network
- ~40-60 small glowing dots (cyan/teal) slowly drifting
- Subtle connecting lines between nearby nodes (within threshold distance)
- Parallax movement — foreground particles faster than background
- Depth-of-field: background particles slightly blurred and dimmer

### DNA Helix
- Simplified wireframe double helix, slowly rotating
- Cyan wireframe style, semi-transparent
- Prominent in Act 1 (brand intro) and Act 4 (closing)

### Pulse Wave
- ECG-style animated line that draws across the screen
- Used as a transition element between scenes
- Cyan glow trail

### Layering Rules
- During UI scenes (3, 4): low opacity (~0.1-0.15), behind everything
- During text/brand scenes (1, 2, 5, 6): higher opacity (~0.3-0.4), more prominent
- Transitions: crossfade + pulse wave sweep as wipe effect

---

## Floating Screen Container

The `<FloatingScreen>` component wraps all UI demo screens.

**Window Chrome:**
- Title bar height: ~32px
- Traffic light dots: red #FF5F57, yellow #FFBD2E, green #27C93F (8px circles, 8px gaps)
- Dark title bar background: `rgba(255,255,255,0.03)`
- Rounded top corners: 12px border-radius

**Container Body:**
- Background: theme card color (#1a1a1a)
- Bottom corners: 12px border-radius
- Content area clips to container bounds

**Shadow & Border:**
- Drop shadow: `0 25px 60px rgba(0,0,0,0.5)`
- Border: `1px solid rgba(255,255,255,0.08)`
- No 3D rotation — flat, elevated via shadow

**Sizing:** ~75% of frame width when visible as a framed container.

**Animations:**
- Entrance: slides up from below frame with spring easing, slight scale 0.95 -> 1.0
- Zoom in: container scales up, chrome fades out at ~1.2x scale, content fills frame
- Zoom out: reverse — content shrinks, chrome fades back in, container visible
- Exit: fade out with slight scale-down or slide down

---

## Project Architecture

```
video/
├── package.json
├── tsconfig.json
├── src/
│   ├── Root.tsx                        # Remotion root — registers composition (1950 frames)
│   ├── DemoVideo.tsx                   # Main composition — sequences all scenes
│   ├── scenes/
│   │   ├── logo-reveal.tsx             # Scene 1: Brand intro + logo assembly
│   │   ├── agent-intro.tsx             # Scene 2: "One Agent. Every Workflow."
│   │   ├── patient-screening.tsx       # Scene 3: Intake chat in floating container
│   │   ├── routing-and-support.tsx     # Scene 4: Doctor workspace + AI panel
│   │   ├── agent-advantages.tsx        # Scene 5: Feature advantage cards
│   │   └── closing-cta.tsx             # Scene 6: Logo + tagline
│   ├── components/
│   │   ├── floating-screen.tsx         # Browser-style container with chrome + shadow
│   │   ├── b-roll-layer.tsx            # Persistent particle network + DNA + pulse wave
│   │   ├── particle-network.tsx        # Animated particle nodes with connections
│   │   ├── dna-helix.tsx               # Rotating wireframe DNA helix
│   │   ├── pulse-wave.tsx              # ECG-style animated line
│   │   ├── stat-card.tsx               # Glass advantage card with icon
│   │   ├── logo-assembly.tsx           # Particles-to-logo convergence animation
│   │   ├── typewriter.tsx              # Frame-based character reveal (existing)
│   │   ├── message-bubble.tsx          # Chat bubble (existing)
│   │   ├── fade-slide.tsx              # Spring entrance/exit (existing)
│   │   ├── dot-matrix-bg.tsx           # Dot-matrix background (existing, inside screens)
│   │   ├── scan-line-overlay.tsx       # Scan-line sweep (existing, inside screens)
│   │   ├── medical-glow.tsx            # Glow effect wrapper (existing)
│   │   ├── cursor-click.tsx            # Animated click cursor (existing)
│   │   └── feature-callout.tsx         # Feature title labels (existing)
│   ├── styles/
│   │   └── theme.ts                    # Color tokens, fonts, spacing (existing)
│   └── data/
│       └── script.ts                   # All demo text content (existing, extend)
```

**Key decisions:**
- Self-contained in `video/` — no shared code with `web/`
- Reuse existing components (typewriter, message-bubble, fade-slide, etc.) inside floating containers
- New components for b-roll system, floating container, and advantage cards
- B-roll layer is persistent across all scenes, only opacity changes
- Scene data centralized in `script.ts`

---

## Theme Tokens

Carried over from existing `theme.ts` (oklch -> hex mapped from web app):

| Token | Value |
|-------|-------|
| background | #141414 |
| foreground | #f0f0f0 |
| card | #1a1a1a |
| border | #303030 |
| muted | #242424 |
| muted-foreground | #999999 |
| cyan-electric | #00d9ff |
| teal-medical | #00b8a9 |
| purple-medical | #6366f1 |
| green-medical | #10b981 |
| navy-deep | #0a0e27 |

**Fonts:** JetBrains Mono (display/headings), system sans-serif for body inside UI screens

**Glow effects (box-shadow):**
- Cyan: `0 0 20px rgba(0,217,255,0.3), 0 0 40px rgba(0,217,255,0.1)`
- Teal: `0 0 15px rgba(0,184,169,0.3), 0 0 30px rgba(0,184,169,0.1)`
- Emerald: `0 0 15px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.1)`

---

## Animation System

- **Easing:** All motion uses Remotion `spring()` with `{fps: 30, damping: 12-15}` — smooth, professional, no bounce
- **Transitions:** Crossfade between scenes (6-frame / 200ms overlap)
- **Typewriter:** Frame-based character reveal at ~2 chars/frame (40 chars/sec)
- **Stagger:** Sequential element entrance with configurable frame delay (3-5 frames)
- **Zoom:** Scale + translate transforms via `interpolate()` for camera movement
- **Parallax:** Multi-speed layer movement for b-roll depth
- **Spring entrances:** All UI elements use spring-based slide + fade

---

## Feature Title Labels

Overlaid during demo scenes. Style: JetBrains Mono, uppercase, `letter-spacing: 0.15em`, subtle cyan text-shadow, fade-in + slide-up entrance.

| Scene | Label | Position |
|-------|-------|----------|
| 3 | "AUTOMATIC PATIENT SCREENING" | Top-left |
| 4 | "INTELLIGENT ROUTING & CLINICAL SUPPORT" | Top-left |
