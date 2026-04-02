import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { ScanLineOverlay } from "../components/scan-line-overlay";
import { MessageBubble } from "../components/message-bubble";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import {
  INTAKE_MESSAGES,
  INTAKE_FORM,
  TRIAGE_RESULT,
  SCENE_CALLOUTS,
} from "../data/script";

export const IntakeChat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Triage card entrance
  const triageFrame = 210; // ~7s into this scene
  const triageScale = spring({
    frame: Math.max(0, frame - triageFrame),
    fps,
    config: { damping: 14 },
  });
  const triageBaseScale = interpolate(triageScale, [0, 1], [0.95, 1]);

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
      <DotMatrixBg fadeInFrames={0} />
      <ScanLineOverlay />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          maxWidth: 768,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(to right, #00d9ff, #00b8a9)",
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: "linear-gradient(to right, #00d9ff, #00b8a9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MEDI-NEXUS
          </span>
          <span style={{ color: colors.mutedForeground, fontSize: 14 }}>
            / Patient Intake
          </span>
        </div>
      </div>

      {/* Chat messages area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 768,
          margin: "0 auto",
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* User message */}
        <MessageBubble
          role="user"
          text={INTAKE_MESSAGES[1].text}
          startFrame={5}
        />

        {/* AI response with typewriter */}
        <MessageBubble
          role="assistant"
          text={INTAKE_MESSAGES[2].text}
          startFrame={20}
          typewriter
          charsPerFrame={2}
        />

        {/* Form fields */}
        <FadeSlide startFrame={100} direction="up" distance={20}>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: 20,
              backgroundColor: colors.card,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {INTAKE_FORM.fields.map((field, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {field.label}
                </span>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.muted,
                    fontSize: 14,
                    color: colors.foreground,
                    fontFamily: fonts.body,
                  }}
                >
                  <Typewriter
                    text={field.value}
                    startFrame={115 + i * 20}
                    charsPerFrame={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        </FadeSlide>

        {/* Triage status card */}
        {frame >= triageFrame && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                borderRadius: radius["2xl"],
                border: "1px solid rgba(16,185,129,0.3)",
                backgroundColor: "rgba(16,185,129,0.05)",
                padding: 16,
                opacity: triageScale,
                transform: `scale(${triageBaseScale})`,
                boxShadow: triageScale > 0.5 ? glows.emerald : "none",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="#34d399"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#34d399",
                    fontFamily: fonts.body,
                  }}
                >
                  Check-in Complete
                </span>
              </div>

              {/* Department */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                  />
                  <path
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                  />
                </svg>
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>Directed to</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.department}
                </span>
              </div>

              {/* Message */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke={colors.mutedForeground}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {TRIAGE_RESULT.message}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature callout */}
      <FeatureCallout
        text={SCENE_CALLOUTS.intake}
        position="top-right"
        startFrame={triageFrame + 20}
      />
    </div>
  );
};
