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
