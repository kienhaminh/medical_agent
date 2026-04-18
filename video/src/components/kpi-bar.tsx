import { useCurrentFrame, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

interface KpiMetric {
  readonly label: string;
  readonly value: number | string;
}

interface KpiBarProps {
  metrics: readonly KpiMetric[];
  enterFrame?: number;
  countDuration?: number;
}

export const KpiBar: React.FC<KpiBarProps> = ({
  metrics,
  enterFrame = 0,
  countDuration = 30,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [enterFrame, enterFrame + 15], [-10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        gap: 0,
        background: colors.card,
        borderRadius: radius.xl,
        padding: "16px 0",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
      }}
    >
      {metrics.map((m, i) => {
        let displayValue: string | number = m.value;
        if (typeof m.value === "number") {
          displayValue = Math.round(
            interpolate(Math.max(0, frame - enterFrame), [0, countDuration], [0, m.value], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          );
        }
        return (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              borderRight: i < metrics.length - 1 ? `1px solid ${colors.border}` : "none",
              padding: "0 32px",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: colors.foreground, fontFamily: fonts.display }}>
              {displayValue}
            </div>
            <div style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 4 }}>
              {m.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
