import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface ProcessingIndicatorProps {
  text: string;
  subtext?: string;
  color?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  text,
  subtext,
  color = "#0891b2",
}) => {
  const frame = useCurrentFrame();

  const dotOpacities = [0, 1, 2].map((i) => {
    const cycle = (frame + i * 8) % 24;
    return interpolate(cycle, [0, 8, 16, 24], [0.3, 1, 0.3, 0.3], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {dotOpacities.map((opacity, i) => (
          <div
            key={i}
            style={{ width: 10, height: 10, borderRadius: "50%", background: color, opacity }}
          />
        ))}
      </div>
      <div style={{ color: "#e2e8f0", fontSize: 16, fontFamily: fonts.display }}>{text}</div>
      {subtext && (
        <div style={{ color: "#64748b", fontSize: 13, fontFamily: fonts.display, letterSpacing: "0.1em" }}>
          {subtext}
        </div>
      )}
    </div>
  );
};
