import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { colors, fonts } from "../styles/theme";

type CalloutPosition =
  | "bottom-center"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "center-below";

interface FeatureCalloutProps {
  text: string;
  position: CalloutPosition;
  startFrame: number;
  endFrame?: number;
}

const positionStyles: Record<CalloutPosition, React.CSSProperties> = {
  "bottom-center": { bottom: 60, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 40, right: 60 },
  "top-center": { top: 40, left: "50%", transform: "translateX(-50%)" },
  "bottom-left": { bottom: 60, left: 60 },
  "center-below": { top: "58%", left: "50%", transform: "translateX(-50%)" },
};

export const FeatureCallout: React.FC<FeatureCalloutProps> = ({
  text,
  position,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 20, mass: 1.2 },
  });

  const exitOpacity =
    endFrame !== undefined
      ? interpolate(frame, [endFrame - 8, endFrame], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        zIndex: 100,
        opacity: enterProgress * exitOpacity,
        transform: `${positionStyles[position].transform ?? ""} translateY(${(1 - enterProgress) * 15}px)`,
      }}
    >
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: colors.cyan,
          textShadow: "none",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
};
