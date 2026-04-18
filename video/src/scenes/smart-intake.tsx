import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import { FeatureCallout } from "../components/feature-callout";
import { IphoneFrame } from "../components/iphone-frame";
import { MessageBubble } from "../components/message-bubble";
import { Typewriter } from "../components/typewriter";
import { FadeSlide } from "../components/fade-slide";
import {
  SCENE_CALLOUTS,
  INTAKE_MESSAGES,
  INTAKE_FORM,
  TRIAGE_RESULT,
} from "../data/script";
import { colors, fonts } from "../styles/theme";

const AutoField: React.FC<{
  label: string;
  value: string;
  startFrame: number;
  fieldType?: "text" | "textarea";
}> = ({ label, value, startFrame, fieldType = "text" }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const charsPerFrame = fieldType === "textarea" ? 1.5 : 2;
  const elapsed = frame - startFrame;
  const visible = Math.min(value.length, Math.floor(elapsed * charsPerFrame));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, fontWeight: 500 }}>
        {label}
      </label>
      <div
        style={{
          background: "#f8f9fb",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: fieldType === "textarea" ? "8px 10px" : "7px 10px",
          fontSize: 13,
          color: colors.foreground,
          fontFamily: fonts.body,
          minHeight: fieldType === "textarea" ? 44 : "auto",
        }}
      >
        {value.slice(0, visible)}
        {visible < value.length && elapsed > 0 && (
          <span style={{ opacity: Math.round((frame % 16) / 8) ? 1 : 0.3 }}>|</span>
        )}
      </div>
    </div>
  );
};

export const SmartIntake: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scrollY = interpolate(
    frame,
    [0, 80, 180, 310, 340],
    [0, 0, -180, -330, -430],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const submitScale = frame >= 310
    ? spring({ frame: frame - 310, fps, config: { damping: 12, mass: 0.8 } })
    : 0;

  const triageProgress = frame >= 340
    ? spring({ frame: frame - 340, fps, config: { damping: 14, mass: 0.9 } })
    : 0;

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

      <FeatureCallout
        text={SCENE_CALLOUTS.patientsTriaged}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <IphoneFrame width={400} enterFrame={0} enterFrom="bottom">
          <div
            style={{
              transform: `translateY(${scrollY}px)`,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition: "none",
            }}
          >
            <MessageBubble
              role="assistant"
              text={INTAKE_MESSAGES[0].text}
              startFrame={20}
              typewriter
              charsPerFrame={3}
              fontSize={14}
            />
            <MessageBubble
              role="user"
              text={INTAKE_MESSAGES[1].text}
              startFrame={80}
              fontSize={14}
            />
            <MessageBubble
              role="assistant"
              text={INTAKE_MESSAGES[2].text}
              startFrame={120}
              typewriter
              charsPerFrame={2.5}
              fontSize={14}
            />

            {frame >= 180 && (
              <FadeSlide startFrame={180} direction="up" distance={20}>
                <div
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                    {INTAKE_FORM.title}
                  </div>
                  {INTAKE_FORM.fields.map((field, i) => (
                    <AutoField
                      key={i}
                      label={field.label}
                      value={field.value}
                      startFrame={200 + i * 20}
                      fieldType={field.type}
                    />
                  ))}
                </div>
              </FadeSlide>
            )}

            {frame >= 310 && (
              <div
                style={{
                  transform: `scale(${0.8 + submitScale * 0.2})`,
                  opacity: 0.2 + submitScale * 0.8,
                  background: "linear-gradient(to right, #0891b2, #0d9488)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fonts.body,
                  textAlign: "center",
                  padding: "12px 0",
                  borderRadius: 10,
                }}
              >
                Submit →
              </div>
            )}

            {frame >= 340 && (
              <div
                style={{
                  transform: `scale(${triageProgress})`,
                  opacity: interpolate(triageProgress, [0, 0.5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  background: "#f0fdf4",
                  border: "1px solid #059669",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#166534", fontFamily: fonts.body }}>
                    {TRIAGE_RESULT.department}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: TRIAGE_RESULT.urgencyColor,
                      fontFamily: fonts.display,
                      background: "rgba(217,119,6,0.08)",
                      padding: "2px 7px",
                      borderRadius: 4,
                    }}
                  >
                    {TRIAGE_RESULT.urgency}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#166534", fontFamily: fonts.body }}>
                  {TRIAGE_RESULT.message}
                </div>
                <div style={{ fontSize: 10, color: "#4ade80", fontFamily: fonts.display, letterSpacing: "0.05em" }}>
                  {TRIAGE_RESULT.trackingId}
                </div>
              </div>
            )}
          </div>
        </IphoneFrame>
      </div>
    </div>
  );
};
