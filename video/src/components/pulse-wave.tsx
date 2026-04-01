import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";

interface PulseWaveProps {
  y?: number;
  opacity?: number;
  speed?: number;
}

export const PulseWave: React.FC<PulseWaveProps> = ({
  y = 540,
  opacity = 0.3,
  speed = 4,
}) => {
  const frame = useCurrentFrame();

  // ECG-style path that draws across the screen
  const drawProgress = (frame * speed) % 2200; // loop across wider than screen

  // Generate ECG-like wave points
  const generateEcgPath = (offsetX: number): string => {
    const points: string[] = [];
    const segments = 40;
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * 1920 + offsetX;
      const t = i / segments;
      let yOffset = 0;

      // Create ECG-like spike pattern
      const cycle = t * 4; // 4 cycles across width
      const phase = cycle % 1;

      if (phase > 0.4 && phase < 0.45) {
        yOffset = -8; // small P wave
      } else if (phase > 0.48 && phase < 0.5) {
        yOffset = -40; // QRS spike up
      } else if (phase > 0.5 && phase < 0.52) {
        yOffset = 15; // QRS dip down
      } else if (phase > 0.55 && phase < 0.62) {
        yOffset = -6; // T wave
      }

      points.push(`${x},${y + yOffset}`);
    }
    return `M${points.join(" L")}`;
  };

  const pathD = generateEcgPath(-drawProgress % 1920);

  // Glow trail mask: only show portion near the "draw head"
  const headX = drawProgress % 1920;
  const trailLength = 400;

  return (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        overflow: "hidden",
      }}
    >
      <defs>
        <linearGradient id="pulseTrail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.cyan} stopOpacity="0" />
          <stop offset="70%" stopColor={colors.cyan} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colors.cyan} stopOpacity="1" />
        </linearGradient>
        <mask id="pulseMask">
          <rect
            x={headX - trailLength}
            y="0"
            width={trailLength}
            height="1080"
            fill="url(#pulseTrail)"
          />
        </mask>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={colors.cyan}
        strokeWidth={2}
        mask="url(#pulseMask)"
      />
      {/* Glow dot at head */}
      <circle
        cx={headX}
        cy={y}
        r={4}
        fill={colors.cyan}
        opacity={0.8}
      />
    </svg>
  );
};
