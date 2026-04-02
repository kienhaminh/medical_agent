import { useCurrentFrame } from "remotion";
import { colors, fonts } from "../styles/theme";
import { LogoAssembly } from "../components/logo-assembly";
import { Typewriter } from "../components/typewriter";
import { PROMO_TAGLINE } from "../data/script";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 10,
        }}
      >
        <LogoAssembly startFrame={15} />

        {frame >= 70 && (
          <div style={{ opacity: 1, marginTop: 8 }}>
            <Typewriter
              text={PROMO_TAGLINE}
              startFrame={75}
              charsPerFrame={1.5}
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: "0.2em",
                color: colors.cyan,
                textShadow: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
