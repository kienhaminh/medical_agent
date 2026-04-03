import { useCurrentFrame, spring, useVideoConfig, interpolate, staticFile } from "remotion";
import { colors, fonts, radius } from "../styles/theme";
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

/* ── Timeline (480 frames @ 30fps = 16s) ──────────────────────
 * Camera starts zoomed into the top of the chat.
 * As each message appears, camera pans down to follow it.
 *
 *  0-15    App header visible, camera at top
 * 15       Msg 0: agent welcome (typewriter)
 * 80       Msg 1: user reply — camera pans down
 * 120      Msg 2: agent form intro — camera pans down
 * 190      Form slides in — camera pans to form
 * 340      Submit button
 * 370      Triage card — camera pans to triage
 * ─────────────────────────────────────────────────────────────── */

/* ── Form sub-components ────────────────────────────────────────── */

const ProgressBar: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  if (frame < startFrame) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.cyan,
          letterSpacing: "0.05em",
          textTransform: "uppercase" as const,
          whiteSpace: "nowrap",
          fontFamily: fonts.body,
        }}
      >
        {INTAKE_FORM.step}
      </span>
      <div style={{ flex: 1, display: "flex", gap: 4 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: colors.cyan }} />
        <div style={{ flex: 1, height: 4, borderRadius: 99, backgroundColor: `${colors.border}60` }} />
      </div>
    </div>
  );
};

const FormField: React.FC<{
  label: string;
  value: string;
  type: "text" | "textarea";
  startFrame: number;
  charsPerFrame?: number;
}> = ({ label, value, type, startFrame, charsPerFrame = 1.2 }) => {
  const isTextarea = type === "textarea";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: colors.mutedForeground,
          fontFamily: fonts.body,
        }}
      >
        {label}
      </span>
      <div
        style={{
          padding: isTextarea ? "10px 14px" : "8px 14px",
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.muted,
          fontSize: 16,
          color: colors.foreground,
          fontFamily: fonts.body,
          lineHeight: 1.5,
          minHeight: isTextarea ? 48 : undefined,
        }}
      >
        <Typewriter text={value} startFrame={startFrame} charsPerFrame={charsPerFrame} />
      </div>
    </div>
  );
};

const SubmitButton: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 18, mass: 1.1 },
  });

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        height: 42,
        borderRadius: radius.lg,
        backgroundImage: "linear-gradient(to right, #0891b2, #0d9488)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: progress,
        transform: `translateY(${(1 - progress) * 10}px)`,
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          fontFamily: fonts.body,
          letterSpacing: "0.02em",
        }}
      >
        Next Step →
      </span>
    </div>
  );
};

/* ── Main scene ─────────────────────────────────────────────────── */

export const PatientScreening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const msg0Start = 15;
  const msg1Start = 80;
  const msg2Start = 120;
  const formStart = 190;
  const submitStart = 340;
  const triageStart = 370;

  const triageScale = spring({
    frame: Math.max(0, frame - triageStart),
    fps,
    config: { damping: 18, mass: 1.2 },
  });
  const triageBaseScale = interpolate(triageScale, [0, 1], [0.95, 1]);

  /* ── Camera scroll: smoothly pan down as content grows ───────── */
  // Each keyframe: [frame, scrollY offset]
  // Negative values scroll content up (camera moves down)
  const scrollY = interpolate(
    frame,
    [0,    msg0Start, msg1Start - 10, msg1Start, msg2Start - 10, msg2Start, formStart - 10, formStart, formStart + 60, submitStart, triageStart - 10, triageStart],
    [0,    0,         0,              -60,       -60,            -140,      -140,           -260,      -380,           -440,       -440,             -540],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Smooth the scroll with spring for organic feel
  const smoothScroll = spring({
    frame,
    fps,
    from: 0,
    to: scrollY,
    config: { damping: 30, mass: 2 },
  });
  // Spring only works frame 0 → target, so use raw interpolate with easing instead
  // We'll just use the interpolated value which already has stepped easing

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />
      <ScanLineOverlay />

      <FeatureCallout
        text={PROMO_CALLOUTS.patientScreening}
        position="top-center"
        startFrame={10}
        endFrame={40}
      />

      {/* Scrollable chat content — camera follows via translateY */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          transform: `translateY(${scrollY}px)`,
          zIndex: 10,
        }}
      >
        {/* App header */}
        <div
          style={{
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: "#fafbfc",
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            gap: 10,
          }}
        >
          <img
            src={staticFile("favicon.ico")}
            style={{ width: 28, height: 28, borderRadius: 7 }}
          />
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.08em",
              backgroundImage: "linear-gradient(to right, #0891b2, #0d9488)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MEDERA
          </span>
          <span style={{ color: colors.mutedForeground, fontSize: 14 }}>
            / Patient Intake
          </span>
        </div>

        {/* Chat messages — generous sizing for close-up readability */}
        <div
          style={{
            padding: "24px 80px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 1200,
          }}
        >
          {/* Msg 0: Agent welcome */}
          <MessageBubble
            role="assistant"
            text={INTAKE_MESSAGES[0].text}
            startFrame={msg0Start}
            typewriter
            charsPerFrame={2}
          />

          {/* Msg 1: User reply */}
          <MessageBubble
            role="user"
            text={INTAKE_MESSAGES[1].text}
            startFrame={msg1Start}
          />

          {/* Msg 2: Agent introduces form */}
          <MessageBubble
            role="assistant"
            text={INTAKE_MESSAGES[2].text}
            startFrame={msg2Start}
            typewriter
            charsPerFrame={2}
          />

          {/* Form */}
          <FadeSlide startFrame={formStart} direction="up" distance={12}>
            <div
              style={{
                borderRadius: radius["2xl"],
                border: `1px solid rgba(8,145,178,0.2)`,
                backgroundColor: "rgba(8,145,178,0.03)",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                maxWidth: 700,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: colors.cyan,
                    fontFamily: fonts.body,
                  }}
                >
                  {INTAKE_FORM.title}
                </span>
                <ProgressBar frame={frame} startFrame={formStart + 5} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: 16,
                  rowGap: 12,
                }}
              >
                {INTAKE_FORM.fields.map((field, i) => (
                  <div
                    key={i}
                    style={{
                      gridColumn: field.type === "textarea" ? "1 / -1" : undefined,
                    }}
                  >
                    <FormField
                      label={field.label}
                      value={field.value}
                      type={field.type}
                      startFrame={formStart + 15 + i * 18}
                    />
                  </div>
                ))}
              </div>

              <SubmitButton frame={frame} startFrame={submitStart} />
            </div>
          </FadeSlide>

          {/* Triage result */}
          {frame >= triageStart && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  maxWidth: 500,
                  borderRadius: radius["2xl"],
                  border: "1px solid rgba(5,150,105,0.2)",
                  backgroundColor: "rgba(5,150,105,0.04)",
                  padding: 16,
                  opacity: triageScale,
                  transform: `scale(${triageBaseScale})`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#059669", fontFamily: fonts.body }}>
                    Check-in Complete
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: colors.mutedForeground }}>Directed to</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                    {TRIAGE_RESULT.department}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: colors.mutedForeground }}>
                  {TRIAGE_RESULT.message}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
