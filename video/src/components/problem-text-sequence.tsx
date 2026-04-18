import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface ProblemLine {
  readonly text: string;
  readonly enterFrame: number;
  readonly exitFrame: number;
  readonly fontSize: number;
  readonly fontWeight?: number;
  readonly color: string;
}

interface ProblemTextSequenceProps {
  lines: readonly ProblemLine[];
}

export const ProblemTextSequence: React.FC<ProblemTextSequenceProps> = ({ lines }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center" }}>
      {lines.map((line, i) => {
        const opacity = interpolate(
          frame,
          [line.enterFrame, line.enterFrame + 20, line.exitFrame - 15, line.exitFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const translateY = interpolate(
          frame,
          [line.enterFrame, line.enterFrame + 20],
          [12, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              fontSize: line.fontSize,
              fontWeight: line.fontWeight ?? 400,
              color: line.color,
              textAlign: "center",
              fontFamily: fonts.body,
              maxWidth: 860,
              lineHeight: 1.35,
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
