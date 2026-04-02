import { useCurrentFrame, spring, useVideoConfig, interpolate, staticFile } from "remotion";
import { colors, fonts, gradients, glows } from "../styles/theme";

interface LogoAssemblyProps {
  /** Frame when assembly animation starts */
  startFrame?: number;
}

// Deterministic particle start positions (spread around screen)
const LOGO_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const distance = 300 + (i % 3) * 150;
  return {
    startX: Math.cos(angle) * distance,
    startY: Math.sin(angle) * distance,
    size: 2 + (i % 4),
  };
});

export const LogoAssembly: React.FC<LogoAssemblyProps> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const assembleProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 20, mass: 2 },
  });

  const logoOpacity = interpolate(assembleProgress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(assembleProgress, [0.8, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Converging particles */}
      {LOGO_PARTICLES.map((p, i) => {
        const x = p.startX * (1 - assembleProgress);
        const y = p.startY * (1 - assembleProgress);
        const particleOpacity = interpolate(assembleProgress, [0, 0.7], [0.8, 0], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: colors.cyan,
              opacity: particleOpacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Logo icon */}
      <img
        src={staticFile("favicon.ico")}
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoOpacity, [0, 1], [0.8, 1])})`,
          filter: glowOpacity > 0.1 ? `drop-shadow(0 0 20px rgba(0,217,255,0.3))` : "none",
        }}
      />

      {/* Brand name */}
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: "0.12em",
          backgroundImage: gradients.cyanToTeal,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoOpacity, [0, 1], [0.9, 1])})`,
        }}
      >
        MEDI-NEXUS
      </span>
    </div>
  );
};
