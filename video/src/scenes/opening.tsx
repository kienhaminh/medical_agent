import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { colors, fonts, gradients } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { ScanLineOverlay } from "../components/scan-line-overlay";
import { FadeSlide } from "../components/fade-slide";
import { CursorClick } from "../components/cursor-click";
import { FeatureCallout } from "../components/feature-callout";
import { SUGGESTIONS, SCENE_CALLOUTS } from "../data/script";

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12 },
  });

  // Online badge pulse
  const pulseDotOpacity = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <DotMatrixBg fadeInFrames={15} />
      <ScanLineOverlay />

      {/* Header bar */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          maxWidth: 768,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo placeholder circle */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: gradients.cyanToTeal,
              opacity: logoScale,
              transform: `scale(${logoScale})`,
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: gradients.cyanToTeal,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: logoScale,
              transform: `scale(${logoScale})`,
            }}
          >
            MEDERA
          </span>
          <span
            style={{
              color: colors.mutedForeground,
              fontSize: 14,
              opacity: logoScale,
            }}
          >
            / Patient Intake
          </span>
        </div>
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,217,255,0.3)",
            color: colors.cyan,
            fontSize: 12,
            letterSpacing: "0.05em",
            opacity: logoScale,
          }}
        >
          HOME
        </div>
      </div>

      {/* Main content area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 80,
          gap: 16,
        }}
      >
        {/* RECEPTION AI ONLINE badge */}
        <FadeSlide startFrame={20} direction="up" distance={20}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 999,
              border: "1px solid rgba(0,217,255,0.3)",
              backgroundColor: "rgba(0,217,255,0.05)",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: colors.cyan,
                opacity: pulseDotOpacity,
              }}
            />
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 12,
                letterSpacing: "0.15em",
                color: colors.cyan,
              }}
            >
              RECEPTION AI ONLINE
            </span>
          </div>
        </FadeSlide>

        {/* Welcome text */}
        <FadeSlide startFrame={30} direction="up" distance={15}>
          <p
            style={{
              color: colors.mutedForeground,
              fontSize: 14,
              maxWidth: 400,
              textAlign: "center",
              fontFamily: fonts.body,
              lineHeight: 1.6,
            }}
          >
            Welcome! I&apos;m the reception assistant. I&apos;ll help you get checked in
            by collecting some information and directing you to the right department.
          </p>
        </FadeSlide>

        {/* Suggestion cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            maxWidth: 400,
            width: "100%",
            marginTop: 16,
          }}
        >
          {SUGGESTIONS.map((suggestion, i) => {
            const isTarget = i === 1; // "I'm experiencing chest pain"
            return (
              <FadeSlide key={i} startFrame={45 + i * 5} direction="up" distance={20}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${
                      isTarget && frame >= 110
                        ? "rgba(0,217,255,0.4)"
                        : `${colors.border}60`
                    }`,
                    backgroundColor:
                      isTarget && frame >= 110
                        ? "rgba(0,217,255,0.08)"
                        : "rgba(26,26,26,0.4)",
                    fontSize: 12,
                    color:
                      isTarget && frame >= 110
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {suggestion}
                </div>
              </FadeSlide>
            );
          })}
        </div>
      </div>

      {/* Cursor */}
      <CursorClick appearFrame={90} clickFrame={110} x={620} y={530} />

      {/* Feature callout */}
      <FeatureCallout
        text={SCENE_CALLOUTS.opening}
        position="bottom-center"
        startFrame={30}
      />
    </div>
  );
};
