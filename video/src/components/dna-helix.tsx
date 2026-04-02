import { useCurrentFrame } from "remotion";
import { colors } from "../styles/theme";

interface DnaHelixProps {
  x?: number;
  y?: number;
  height?: number;
  opacity?: number;
}

export const DnaHelix: React.FC<DnaHelixProps> = ({
  x = 1600,
  y = 200,
  height = 400,
  opacity = 0.25,
}) => {
  const frame = useCurrentFrame();
  const rotation = frame * 0.4; // degrees per frame (slow cinematic rotation)

  // Generate helix points
  const pointCount = 20;
  const points: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const angle = t * Math.PI * 4 + (rotation * Math.PI) / 180;
    const yPos = t * height;
    const radius = 30;

    points.push({
      x1: Math.cos(angle) * radius,
      y1: yPos,
      x2: Math.cos(angle + Math.PI) * radius,
      y2: yPos,
      t,
    });
  }

  return (
    <svg
      width="100"
      height={height}
      viewBox={`-40 0 80 ${height}`}
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        overflow: "visible",
      }}
    >
      {/* Strand 1 */}
      <polyline
        points={points.map((p) => `${p.x1},${p.y1}`).join(" ")}
        fill="none"
        stroke={colors.cyan}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Strand 2 */}
      <polyline
        points={points.map((p) => `${p.x2},${p.y2}`).join(" ")}
        fill="none"
        stroke={colors.teal}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Rungs */}
      {points
        .filter((_, i) => i % 2 === 0)
        .map((p, i) => (
          <line
            key={i}
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={colors.cyan}
            strokeWidth={0.8}
            opacity={0.3}
          />
        ))}
      {/* Node dots */}
      {points.map((p, i) => (
        <g key={`dots-${i}`}>
          <circle cx={p.x1} cy={p.y1} r={2} fill={colors.cyan} opacity={0.7} />
          <circle cx={p.x2} cy={p.y2} r={2} fill={colors.teal} opacity={0.7} />
        </g>
      ))}
    </svg>
  );
};
