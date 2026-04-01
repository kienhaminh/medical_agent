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
