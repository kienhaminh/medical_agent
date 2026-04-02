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
  const bgOpacity = fadeInFrames <= 0
    ? 1
    : interpolate(frame, [0, fadeInFrames], [0, 1], {
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: gradients.dotMatrix,
          backgroundSize: "20px 20px",
          opacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "50%",
          background: "linear-gradient(to bottom left, rgba(0,217,255,0.08), transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "50%",
          height: "50%",
          background: "linear-gradient(to top right, rgba(0,184,169,0.08), transparent)",
        }}
      />
    </div>
  );
};
