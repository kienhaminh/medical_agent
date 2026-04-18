import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { FloatingScreen } from "../components/floating-screen";
import { FeatureCallout } from "../components/feature-callout";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { DotMatrixBg } from "../components/dot-matrix-bg";
import {
  SCENE_CALLOUTS,
  PATIENT_LIST,
  PATIENT_HEADER,
  PATIENT_VITALS,
  VISIT_BRIEF,
  SUGGESTED_ORDERS,
  AI_DOCTOR_QUERY,
  AI_TOOL_CALLS,
  AI_RESPONSE,
} from "../data/script";
import { colors, fonts, radius } from "../styles/theme";

const PatientQueue: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const clickProgress = frame >= 100
    ? spring({ frame: frame - 100, fps, config: { damping: 12, mass: 0.8 } })
    : 0;

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 8, height: "100%", padding: "12px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        Patient Queue
      </div>

      {PATIENT_LIST.map((patient, i) => {
        const enterProgress = spring({
          frame: Math.max(0, frame - (15 + i * 8)),
          fps,
          config: { damping: 18, mass: 1 },
        });
        const entryOpacity = interpolate(enterProgress, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const translateX = interpolate(enterProgress, [0, 1], [-12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        const isSelected = "selected" in patient && patient.selected;
        const selectedGlow = isSelected && frame >= 100
          ? interpolate(frame, [100, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 0;

        return (
          <div
            key={i}
            style={{
              opacity: entryOpacity,
              transform: `translateX(${translateX}px)`,
              background: isSelected ? `rgba(8,145,178,${0.04 + selectedGlow * 0.08})` : colors.card,
              border: `1px solid ${isSelected ? `rgba(8,145,178,${0.15 + selectedGlow * 0.2})` : colors.border}`,
              borderRadius: radius.md,
              padding: "8px 10px",
              boxShadow: isSelected && selectedGlow > 0.5 ? `0 0 0 2px rgba(8,145,178,${selectedGlow * 0.25})` : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
                {patient.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: patient.urgencyColor,
                  fontFamily: fonts.display,
                  background: `${patient.urgencyColor}18`,
                  padding: "1px 6px",
                  borderRadius: 3,
                }}
              >
                {patient.urgency}
              </span>
            </div>
            <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 2 }}>
              {patient.complaint} · {patient.waitMinutes}m wait
            </div>
          </div>
        );
      })}

      {frame >= 80 && (
        <div
          style={{
            marginTop: "auto",
            transform: `scale(${0.95 + clickProgress * 0.05})`,
            background: "linear-gradient(to right, #0891b2, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fonts.body,
            textAlign: "center",
            padding: "10px 0",
            borderRadius: radius.md,
            opacity: interpolate(frame, [80, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Accept Patient
        </div>
      )}
    </div>
  );
};

const ClinicalWorkspace: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 10, height: "100%", padding: "12px 10px", overflowY: "hidden" }}>
      {frame >= 170 && (
        <FadeSlide startFrame={170} direction="up" distance={12}>
          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.foreground, fontFamily: fonts.body }}>
                {PATIENT_HEADER.name}
              </div>
              <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, marginTop: 2 }}>
                {PATIENT_HEADER.age}y · {PATIENT_HEADER.sex} · {PATIENT_HEADER.visitId}
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: colors.cyan,
                fontFamily: fonts.display,
                background: "rgba(8,145,178,0.08)",
                padding: "3px 8px",
                borderRadius: 4,
                letterSpacing: "0.05em",
              }}
            >
              ACTIVE
            </div>
          </div>
        </FadeSlide>
      )}

      {frame >= 185 && (
        <div style={{ display: "flex", gap: 6 }}>
          {PATIENT_VITALS.map((v, i) => {
            const vEnter = 185 + i * 10;
            const vOpacity = interpolate(frame, [vEnter, vEnter + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  opacity: vOpacity,
                  background: "#f8f9fb",
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.display }}>{v.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.foreground, fontFamily: fonts.display, marginTop: 2 }}>
                  {v.value}
                </div>
                <div style={{ fontSize: 9, color: colors.mutedForeground, fontFamily: fonts.body }}>{v.unit}</div>
              </div>
            );
          })}
        </div>
      )}

      {frame >= 210 && (
        <div
          style={{
            background: "#f0f9ff",
            borderLeft: "3px solid #0891b2",
            borderRadius: `0 ${radius.md}px ${radius.md}px 0`,
            padding: "10px 12px",
            fontSize: 12,
            color: colors.foreground,
            fontFamily: fonts.body,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.cyan, fontFamily: fonts.display, letterSpacing: "0.08em", marginBottom: 6 }}>
            AI PRE-VISIT BRIEF
          </div>
          <Typewriter text={VISIT_BRIEF} startFrame={215} charsPerFrame={2} />
        </div>
      )}

      {frame >= 270 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Suggested Orders
          </div>
          {SUGGESTED_ORDERS.map((order, i) => {
            const oEnter = 270 + i * 8;
            const oOpacity = interpolate(frame, [oEnter, oEnter + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const oY = interpolate(frame, [oEnter, oEnter + 12], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  opacity: oOpacity,
                  transform: `translateY(${oY}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "7px 10px",
                }}
              >
                <span style={{ fontSize: 12, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: order.badgeColor,
                    background: `${order.badgeColor}15`,
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontFamily: fonts.display,
                  }}
                >
                  {order.badge}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AiAssistant: React.FC<{ panelOpacity: number }> = ({ panelOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const getToolStatus = (i: number): "idle" | "running" | "done" => {
    const runStart = 360 + i * 15;
    const doneStart = runStart + 20;
    if (frame >= doneStart) return "done";
    if (frame >= runStart) return "running";
    return "idle";
  };

  const btnProgress = frame >= 475
    ? spring({ frame: frame - 475, fps, config: { damping: 14, mass: 0.9 } })
    : 0;

  return (
    <div style={{ opacity: panelOpacity, display: "flex", flexDirection: "column", gap: 8, height: "100%", padding: "12px 10px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.mutedForeground, fontFamily: fonts.display, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        AI Assistant
      </div>

      {frame >= 330 && (
        <FadeSlide startFrame={330} direction="right" distance={16}>
          <div
            style={{
              background: "rgba(8,145,178,0.07)",
              border: "1px solid rgba(8,145,178,0.15)",
              borderRadius: radius.md,
              padding: "8px 12px",
              fontSize: 12,
              color: colors.foreground,
              fontFamily: fonts.body,
              lineHeight: 1.4,
            }}
          >
            {AI_DOCTOR_QUERY}
          </div>
        </FadeSlide>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {AI_TOOL_CALLS.map((tool, i) => {
          const status = getToolStatus(i);
          const toolEnter = 360 + i * 15;
          const toolOpacity = interpolate(frame, [toolEnter, toolEnter + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (status === "idle") return null;
          return (
            <div
              key={i}
              style={{
                opacity: toolOpacity,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f8f9fb",
                border: `1px solid ${colors.border}`,
                borderRadius: radius.sm,
                padding: "6px 8px",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: status === "done" ? "#059669" : "#d97706",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.display }}>{tool.name}</span>
              <span
                style={{
                  fontSize: 10,
                  color: status === "done" ? "#059669" : "#d97706",
                  fontFamily: fonts.display,
                  marginLeft: "auto",
                }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>

      {frame >= 425 && (
        <div
          style={{
            background: "#f8f9fb",
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: "10px 12px",
            fontSize: 12,
            color: colors.foreground,
            fontFamily: fonts.body,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.cyan, fontFamily: fonts.display, letterSpacing: "0.06em", marginBottom: 6 }}>
            MEDERA AI
          </div>
          <Typewriter text={AI_RESPONSE} startFrame={430} charsPerFrame={2} />
        </div>
      )}

      {frame >= 475 && (
        <div
          style={{
            marginTop: "auto",
            transform: `scale(${0.9 + btnProgress * 0.1})`,
            opacity: interpolate(btnProgress, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            background: "linear-gradient(to right, #0891b2, #0d9488)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: fonts.body,
            textAlign: "center",
            padding: "10px 0",
            borderRadius: radius.md,
            boxShadow: `0 0 ${btnProgress * 12}px rgba(8,145,178,${btnProgress * 0.3})`,
          }}
        >
          + Place Order
        </div>
      )}
    </div>
  );
};

export const DoctorWorkspace: React.FC = () => {
  const frame = useCurrentFrame();

  const beat1 = interpolate(frame, [130, 160], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat2Focus = interpolate(frame, [150, 170], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat2Defocus = interpolate(frame, [290, 315], [1, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat3 = interpolate(frame, [310, 335], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const leftOpacity = Math.min(beat1, 1);
  const centerOpacity = Math.min(beat2Focus, beat2Defocus);
  const rightOpacity = beat3;

  const calloutText =
    frame < 150 ? SCENE_CALLOUTS.oneClickToStart
    : frame < 310 ? SCENE_CALLOUTS.aiPreVisitBrief
    : SCENE_CALLOUTS.aiThinks;

  const calloutKey = frame < 150 ? 0 : frame < 310 ? 1 : 2;
  const calloutStartFrame = [0, 155, 315][calloutKey];

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#f8f9fb",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />

      <FeatureCallout
        text={calloutText}
        position="top-center"
        startFrame={calloutStartFrame}
        endFrame={calloutStartFrame + 40}
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
        <FloatingScreen enterFrame={0} widthPercent={82} variant="desktop">
          <div style={{ display: "flex", height: "100%", gap: 0 }}>
            <div style={{ width: "24%", borderRight: `1px solid ${colors.border}`, height: "100%" }}>
              <PatientQueue panelOpacity={leftOpacity} />
            </div>
            <div style={{ width: "44%", borderRight: `1px solid ${colors.border}`, height: "100%" }}>
              <ClinicalWorkspace panelOpacity={centerOpacity} />
            </div>
            <div style={{ width: "32%", height: "100%" }}>
              <AiAssistant panelOpacity={rightOpacity} />
            </div>
          </div>
        </FloatingScreen>
      </div>
    </div>
  );
};
