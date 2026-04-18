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
