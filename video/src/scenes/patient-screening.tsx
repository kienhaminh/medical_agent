import { useCurrentFrame, spring, useVideoConfig, interpolate, staticFile } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FloatingScreen } from "../components/floating-screen";
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
  PROMO_CALLOUTS,
} from "../data/script";

const IntakeChatContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const triageFrame = 280;
  const triageScale = spring({
    frame: Math.max(0, frame - triageFrame),
    fps,
    config: { damping: 14 },
  });
  const triageBaseScale = interpolate(triageScale, [0, 1], [0.95, 1]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.2} />
      <ScanLineOverlay />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderBottom: `1px solid ${colors.border}50`,
          backgroundColor: "rgba(20,20,20,0.6)",
          height: 48,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src={staticFile("favicon.ico")}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
            }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: "linear-gradient(to right, #00d9ff, #00b8a9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MEDI-NEXUS
          </span>
          <span style={{ color: colors.mutedForeground, fontSize: 12 }}>
            / Patient Intake
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <MessageBubble role="user" text={INTAKE_MESSAGES.userMessage} startFrame={30} />
        <MessageBubble
          role="assistant"
          text={INTAKE_MESSAGES.aiMessage}
          startFrame={50}
          typewriter
          charsPerFrame={2}
        />

        {/* Form */}
        <FadeSlide startFrame={140} direction="up" distance={15}>
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: 16,
              backgroundColor: colors.card,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {INTAKE_FORM.fields.map((field, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: colors.mutedForeground,
                    fontFamily: fonts.body,
                  }}
                >
                  {field.label}
                </span>
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.muted,
                    fontSize: 13,
                    color: colors.foreground,
                    fontFamily: fonts.body,
                  }}
                >
                  <Typewriter text={field.value} startFrame={155 + i * 20} charsPerFrame={1.5} />
                </div>
              </div>
            ))}
          </div>
        </FadeSlide>

        {/* Triage card */}
        {frame >= triageFrame && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                borderRadius: radius["2xl"],
                border: "1px solid rgba(16,185,129,0.3)",
                backgroundColor: "rgba(16,185,129,0.05)",
                padding: 14,
                opacity: triageScale,
                transform: `scale(${triageBaseScale})`,
                boxShadow: triageScale > 0.5 ? glows.emerald : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#34d399", fontFamily: fonts.body }}>
                  Check-in Complete
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: colors.mutedForeground }}>Directed to</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.department}
                </span>
              </div>
              <span style={{ fontSize: 11, color: colors.mutedForeground }}>
                {TRIAGE_RESULT.message}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const PatientScreening: React.FC = () => {
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
      {/* Feature title */}
      <FeatureCallout
        text={PROMO_CALLOUTS.patientScreening}
        position="top-center"
        startFrame={10}
        endFrame={40}
      />

      {/* Floating container with intake chat */}
      <FloatingScreen
        enterFrame={5}
        zoomInFrame={200}
        enterFrom="bottom"
        widthPercent={70}
      >
        <IntakeChatContent />
      </FloatingScreen>
    </div>
  );
};
