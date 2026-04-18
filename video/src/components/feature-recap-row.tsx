import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Stethoscope, LayoutDashboard, Brain, BarChart2 } from "lucide-react";
import { fonts, colors } from "../styles/theme";

const RECAP_ICONS: React.FC<{ size?: number; color?: string; strokeWidth?: number }>[] = [
  Stethoscope,
  LayoutDashboard,
  Brain,
  BarChart2,
];

interface RecapItem {
  readonly label: string;
}

interface FeatureRecapRowProps {
  items: readonly RecapItem[];
  enterFrame?: number;
  exitFrame?: number;
}

export const FeatureRecapRow: React.FC<FeatureRecapRowProps> = ({
  items,
  enterFrame = 0,
  exitFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rowOpacity =
    exitFrame !== undefined
      ? interpolate(frame, [exitFrame - 15, exitFrame], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <div
      style={{
        display: "flex",
        gap: 64,
        alignItems: "center",
        justifyContent: "center",
        opacity: rowOpacity,
      }}
    >
      {items.map((item, i) => {
        const Icon = RECAP_ICONS[i % RECAP_ICONS.length];
        const itemEnter = enterFrame + i * 10;
        const progress = spring({
          frame: Math.max(0, frame - itemEnter),
          fps,
          config: { damping: 20, mass: 1.2 },
        });
        const opacity = interpolate(progress, [0, 0.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `scale(${progress})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "rgba(8,145,178,0.1)",
                border: "1px solid rgba(8,145,178,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={28} color={colors.cyan} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: 14,
                color: colors.foreground,
                fontFamily: fonts.body,
                fontWeight: 500,
              }}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
