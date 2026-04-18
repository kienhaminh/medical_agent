import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Network, Brain, Stethoscope, Scan } from "lucide-react";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { ParticleNetwork } from "../components/particle-network";
import { DnaHelix } from "../components/dna-helix";
import { BRAND_TAGLINE } from "../data/script";
import { colors, fonts } from "../styles/theme";

const FEATURE_ICONS = [
  { Icon: Stethoscope, label: "Screen" },
  { Icon: Network, label: "Route" },
  { Icon: Brain, label: "Assist" },
  { Icon: Scan, label: "Analyze" },
] as const;

export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgLightness = interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bgR = Math.round(interpolate(bgLightness, [0, 1], [10, 248]));
  const bgG = Math.round(interpolate(bgLightness, [0, 1], [14, 249]));
  const bgB = Math.round(interpolate(bgLightness, [0, 1], [23, 251]));

  const fadeOut = interpolate(frame, [190, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: `rgb(${bgR},${bgG},${bgB})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: interpolate(frame, [0, 50, 100], [0.2, 0.3, 0.35], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <ParticleNetwork opacity={1} fadeInFrames={30} />
        <DnaHelix x={1600} y={150} height={400} opacity={0.25} />
        <DnaHelix x={200} y={500} height={300} opacity={0.15} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          zIndex: 1,
        }}
      >
        <LogoAssembly startFrame={0} />

        {frame >= 85 && (
          <div>
            <Typewriter
              text={BRAND_TAGLINE}
              startFrame={85}
              charsPerFrame={2.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 36,
                fontWeight: 700,
                background: "linear-gradient(to right, #0891b2, #0d9488)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            />
          </div>
        )}

        {frame >= 140 && (
          <div style={{ display: "flex", gap: 80, alignItems: "center", marginTop: 8 }}>
            {FEATURE_ICONS.map(({ Icon, label }, i) => {
              const iconEnter = 140 + i * 12;
              const progress = spring({
                frame: Math.max(0, frame - iconEnter),
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
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: "rgba(8,145,178,0.1)",
                      border: "1px solid rgba(8,145,178,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={26} color={colors.cyan} strokeWidth={1.5} />
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      color: colors.mutedForeground,
                      fontFamily: fonts.body,
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#f8f9fb",
          opacity: fadeOut,
          zIndex: 10,
        }}
      />
    </div>
  );
};
