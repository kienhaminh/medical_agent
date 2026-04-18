import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface LegendItem {
  readonly color: string;
  readonly label: string;
}

interface SegmentationLegendProps {
  items: readonly LegendItem[];
  enterFrame?: number;
}

export const SegmentationLegend: React.FC<SegmentationLegendProps> = ({
  items,
  enterFrame = 0,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((item, i) => {
        const itemEnter = enterFrame + i * 10;
        const opacity = interpolate(frame, [itemEnter, itemEnter + 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateX = interpolate(frame, [itemEnter, itemEnter + 15], [-12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `translateX(${translateX}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: item.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#e2e8f0", fontSize: 14, fontFamily: fonts.display }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
