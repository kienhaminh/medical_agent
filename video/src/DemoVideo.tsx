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
