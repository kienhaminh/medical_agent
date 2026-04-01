import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  layer: "front" | "back";
}

// Deterministic particle positions (seeded from index)
const generateParticles = (count: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 137.508) % 1; // golden angle distribution
    const seed2 = ((i * 97.531 + 43) % 100) / 100;
    const seed3 = ((i * 53.217 + 17) % 100) / 100;
    particles.push({
      x: (seed * 1920),
      y: (seed2 * 1080),
      size: 2 + seed3 * 3,
      speed: 0.3 + seed3 * 0.7,
      layer: i % 3 === 0 ? "back" : "front",
    });
  }
  return particles;
};

const PARTICLES = generateParticles(50);
const CONNECTION_DISTANCE = 150;

interface ParticleNetworkProps {
  opacity?: number;
  fadeInFrames?: number;
}

export const ParticleNetwork: React.FC<ParticleNetworkProps> = ({
  opacity = 0.3,
  fadeInFrames = 30,
}) => {
  const frame = useCurrentFrame();

  const fadeIn = fadeInFrames <= 0
    ? 1
    : interpolate(frame, [0, fadeInFrames], [0, 1], {
        extrapolateRight: "clamp",
      });

  // Animate particle positions
  const getPos = (p: Particle) => {
    const drift = frame * p.speed * 0.3;
    const x = ((p.x + drift * (p.layer === "front" ? 1 : 0.5)) % 1960) - 20;
    const y = p.y + Math.sin(frame * 0.02 * p.speed + p.x) * 20;
    return { x, y };
  };

  const positions = PARTICLES.map(getPos);

  // Build connection lines
  const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DISTANCE) {
        lines.push({
          x1: positions[i].x,
          y1: positions[i].y,
          x2: positions[j].x,
          y2: positions[j].y,
          opacity: 1 - dist / CONNECTION_DISTANCE,
        });
      }
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: fadeIn * opacity,
        overflow: "hidden",
      }}
    >
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        {/* Connection lines */}
        {lines.map((line, i) => (
          <line
            key={`l-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={colors.cyan}
            strokeWidth={0.5}
            opacity={line.opacity * 0.4}
          />
        ))}
        {/* Particles */}
        {PARTICLES.map((p, i) => {
          const pos = positions[i];
          const particleOpacity = p.layer === "back" ? 0.4 : 0.8;
          return (
            <circle
              key={`p-${i}`}
              cx={pos.x}
              cy={pos.y}
              r={p.size * (p.layer === "back" ? 0.7 : 1)}
              fill={colors.cyan}
              opacity={particleOpacity}
              filter={p.layer === "back" ? "blur(1px)" : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
};
