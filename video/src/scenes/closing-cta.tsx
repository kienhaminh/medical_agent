import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles/theme";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { PROMO_CLOSING_TAGLINE } from "../data/script";

export const ClosingCta: React.FC = () => {
  const frame = useCurrentFrame();
  const glowPulse = 0.3 + 0.2 * Math.sin((frame / 20) * Math.PI);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,217,255,${glowPulse * 0.15}) 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          zIndex: 10,
        }}
      >
        <LogoAssembly startFrame={10} />

        {frame >= 60 && (
          <div style={{ marginTop: 8 }}>
            <Typewriter
              text={PROMO_CLOSING_TAGLINE}
              startFrame={65}
              charsPerFrame={1.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: colors.cyan,
                textShadow: "0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(0,217,255,0.2)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
