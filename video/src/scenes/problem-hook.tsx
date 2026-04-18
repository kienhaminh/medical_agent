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
      <div style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
        <ParticleNetwork opacity={1} fadeInFrames={30} />
        <PulseWave y={900} opacity={0.3} speed={3} />
      </div>

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
