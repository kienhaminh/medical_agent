import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, gradients } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { SCENE_CALLOUTS } from "../data/script";

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Discharge button click at frame 15, then ripple
  const showRipple = frame >= 15;
  const rippleProgress = showRipple
    ? interpolate(frame - 15, [0, 20], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  // Workspace fade out starts at frame 30
  const workspaceFade = interpolate(frame, [30, 54], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo entrance starts at frame 60
  const logoProgress = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 15 },
  });

  // Tagline fade in 15 frames after logo
  const taglineProgress = spring({
    frame: Math.max(0, frame - 75),
    fps,
    config: { damping: 14 },
  });

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
      {/* Dot matrix returns with logo */}
      {frame >= 55 && <DotMatrixBg fadeInFrames={15} opacity={0.15} />}

      {/* Workspace remnant fading out */}
      {workspaceFade > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: workspaceFade,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 1200,
              height: 700,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.card,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 24,
              position: "relative",
            }}
          >
            {/* Discharge button */}
            <div
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                backgroundColor: frame >= 15 ? colors.green : colors.muted,
                color: colors.white,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: fonts.body,
                position: "relative",
              }}
            >
              Discharge Patient
              {showRipple && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 200 * rippleProgress,
                    height: 200 * rippleProgress,
                    borderRadius: "50%",
                    border: `2px solid ${colors.green}`,
                    opacity: 1 - rippleProgress,
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logo + Tagline */}
      {frame >= 55 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {/* Logo icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: gradients.cyanToTeal,
              opacity: logoProgress,
              transform: `scale(${logoProgress})`,
              boxShadow: logoProgress > 0.5 ? glows.cyan : "none",
            }}
          />

          {/* Brand name */}
          <div
            style={{
              opacity: logoProgress,
              transform: `scale(${interpolate(logoProgress, [0, 1], [0.9, 1])})`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: "0.12em",
                backgroundImage: gradients.cyanToTeal,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MEDERA
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              opacity: taglineProgress,
              transform: `translateY(${(1 - taglineProgress) * 10}px)`,
            }}
          >
            <span
              style={{
                fontFamily: fonts.display,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: colors.cyan,
                textShadow: "0 0 20px rgba(0,217,255,0.5), 0 0 40px rgba(0,217,255,0.2)",
                textTransform: "uppercase",
              }}
            >
              {SCENE_CALLOUTS.closing}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
