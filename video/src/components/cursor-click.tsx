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

  const rippleProgress = clicked
    ? interpolate(frame - clickFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  if (!visible) return null;

  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
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
