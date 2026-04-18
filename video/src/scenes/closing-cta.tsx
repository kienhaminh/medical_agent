import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "../components/particle-network";
import { DnaHelix } from "../components/dna-helix";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { FeatureRecapRow } from "../components/feature-recap-row";
import { FEATURE_RECAP, CLOSING_TAGLINE, CLOSING_URL } from "../data/script";
import { fonts } from "../styles/theme";

export const ClosingCta: React.FC = () => {
  const frame = useCurrentFrame();

  const darkness = interpolate(frame, [80, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgR = Math.round(interpolate(darkness, [0, 1], [248, 10]));
  const bgG = Math.round(interpolate(darkness, [0, 1], [249, 14]));
  const bgB = Math.round(interpolate(darkness, [0, 1], [251, 23]));

  const urlOpacity = interpolate(frame, [220, 240], [0, 1], {
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
          opacity: interpolate(darkness, [0, 1], [0.2, 0.4], {
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
          gap: 40,
          zIndex: 1,
        }}
      >
        {frame < 130 && (
          <FeatureRecapRow items={FEATURE_RECAP} enterFrame={15} exitFrame={120} />
        )}

        {frame >= 100 && (
          <LogoAssembly startFrame={100} />
        )}

        {frame >= 160 && (
          <Typewriter
            text={CLOSING_TAGLINE}
            startFrame={160}
            charsPerFrame={2}
            style={{
              fontFamily: fonts.display,
              fontSize: 40,
              fontWeight: 700,
              background: "linear-gradient(to right, #0891b2, #0d9488)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.05em",
            }}
          />
        )}

        <div
          style={{
            opacity: urlOpacity,
            fontSize: 24,
            color: "#94a3b8",
            fontFamily: fonts.body,
          }}
        >
          {CLOSING_URL}
        </div>
      </div>
    </div>
  );
};
