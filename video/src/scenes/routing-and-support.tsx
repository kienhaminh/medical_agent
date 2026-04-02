import { useCurrentFrame, spring, useVideoConfig, interpolate, staticFile } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FloatingScreen } from "../components/floating-screen";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import {
  PATIENT_LIST,
  VISIT_BRIEF,
  ORDERS,
  SOAP_NOTE,
  AI_TOOL_CALLS,
  AI_RESPONSE,
  PROMO_CALLOUTS,
} from "../data/script";

const URGENCY_COLORS = {
  critical: "#ef4444",
  urgent: "#f59e0b",
  routine: "#10b981",
} as const;

const DoctorWorkspaceContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelProgress = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 18, mass: 1.3 },
  });

  const aiSectionStart = 200;
  const toolStartFrame = aiSectionStart + 20;

  const buttonGlowOpacity =
    frame > aiSectionStart + 180
      ? 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI)
      : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          backgroundColor: colors.card,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              backgroundImage: "linear-gradient(to right, #0891b2, #0d9488)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MEDI-NEXUS
          </span>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.muted,
              color: colors.mutedForeground,
              fontSize: 11,
              fontFamily: fonts.body,
              width: 200,
            }}
          >
            Search patients...
          </div>
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: colors.muted,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: colors.mutedForeground,
            fontFamily: fonts.display,
          }}
        >
          DR
        </div>
      </div>

      {/* 3-Zone Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Zone A: Patient List */}
        <div
          style={{
            width: 200,
            borderRight: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * -200}px)`,
            opacity: panelProgress,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 10,
              letterSpacing: "0.1em",
              color: colors.mutedForeground,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            My Patients
          </span>
          {PATIENT_LIST.map((patient, i) => (
            <FadeSlide key={i} startFrame={15 + i * 6} direction="left" distance={12}>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${"selected" in patient && patient.selected ? "rgba(8,145,178,0.25)" : "transparent"}`,
                  backgroundColor: "selected" in patient && patient.selected ? "rgba(8,145,178,0.06)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: URGENCY_COLORS[patient.urgency],
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500, color: colors.foreground, fontFamily: fonts.body, flex: 1 }}>
                    {patient.name}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: colors.mutedForeground, paddingLeft: 12 }}>
                  {patient.complaint}
                </span>
              </div>
            </FadeSlide>
          ))}
        </div>

        {/* Zone B: Clinical Workspace */}
        <div
          style={{
            flex: 1,
            transform: `scaleX(${interpolate(panelProgress, [0, 1], [0.8, 1])})`,
            opacity: panelProgress,
            padding: 14,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Patient card */}
          <FadeSlide startFrame={25} direction="up" distance={12}>
            <div
              style={{
                padding: 12,
                borderRadius: radius.lg,
                border: "1px solid rgba(8,145,178,0.2)",
                backgroundColor: colors.card,
                boxShadow: frame > 35 ? glows.cyan : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>Sarah Chen</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 999,
                      backgroundColor: "rgba(217,119,6,0.1)",
                      color: colors.amber,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    URGENT
                  </span>
                </div>
                <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body }}>
                  42F — Chief Complaint: Chest pain
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 10, color: colors.mutedForeground }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>128/82</div>
                  <div>BP</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>92</div>
                  <div>HR</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>98%</div>
                  <div>SpO2</div>
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* Brief + Orders */}
          <div style={{ display: "flex", gap: 12, flex: 1 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <FadeSlide startFrame={50} direction="up" distance={12}>
                <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground, display: "block", marginBottom: 6 }}>Pre-Visit Brief</span>
                  <div style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.5 }}>
                    <Typewriter text={VISIT_BRIEF} startFrame={60} charsPerFrame={3} />
                  </div>
                </div>
              </FadeSlide>

              <FadeSlide startFrame={70} direction="up" distance={12}>
                <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground, display: "block", marginBottom: 6 }}>Orders</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {ORDERS.map((order, i) => (
                      <FadeSlide key={i} startFrame={80 + i * 3} direction="up" distance={8}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: radius.md, backgroundColor: colors.muted }}>
                          <span style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 6px",
                              borderRadius: 999,
                              backgroundColor: order.type === "Lab" ? "rgba(99,102,241,0.08)" : "rgba(13,148,136,0.08)",
                              color: order.type === "Lab" ? colors.purple : colors.teal,
                              fontWeight: 500,
                            }}
                          >
                            {order.type}
                          </span>
                        </div>
                      </FadeSlide>
                    ))}
                  </div>
                </div>
              </FadeSlide>
            </div>

            {/* Notes */}
            <FadeSlide startFrame={90} direction="up" distance={12} style={{ flex: 1 }}>
              <div style={{ padding: 12, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground }}>Clinical Notes</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, backgroundColor: "rgba(99,102,241,0.08)", color: colors.purple, marginLeft: "auto" }}>AI Draft</span>
                </div>
                <div style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.mono, lineHeight: 1.6, whiteSpace: "pre-wrap", padding: 10, borderRadius: radius.md, backgroundColor: colors.muted, minHeight: 120 }}>
                  <Typewriter text={SOAP_NOTE} startFrame={100} charsPerFrame={2} />
                </div>
              </div>
            </FadeSlide>
          </div>
        </div>

        {/* Zone C: AI Panel */}
        <div
          style={{
            width: 260,
            borderLeft: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * 260}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${colors.border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: fonts.display, fontSize: 11, fontWeight: 600, color: colors.foreground }}>AI Assistant</span>
          </div>

          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Doctor question */}
            {frame >= aiSectionStart && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius["2xl"],
                    borderBottomRightRadius: 4,
                    backgroundColor: "rgba(8,145,178,0.08)",
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.body,
                    maxWidth: "80%",
                  }}
                >
                  Review labs and recommend next steps
                </div>
              </div>
            )}

            {/* Tool calls */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {AI_TOOL_CALLS.map((tool, i) => {
                const toolFrame = toolStartFrame + i * 10;
                const toolProgress = spring({
                  frame: Math.max(0, frame - toolFrame),
                  fps,
                  config: { damping: 18, mass: 1.1 },
                });
                const isCompleted = frame >= toolFrame + 15;

                if (frame < toolFrame) return null;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px",
                      borderRadius: radius.md,
                      backgroundColor: colors.muted,
                      opacity: toolProgress,
                      transform: `translateY(${(1 - toolProgress) * 10}px)`,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: 10, color: colors.foreground, fontFamily: fonts.mono, flex: 1 }}>
                      {tool.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        borderRadius: 999,
                        backgroundColor: isCompleted ? "rgba(5,150,105,0.08)" : "rgba(217,119,6,0.08)",
                        color: isCompleted ? colors.green : colors.amber,
                        fontWeight: 500,
                      }}
                    >
                      {isCompleted ? "done" : "running"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Response */}
            {frame >= toolStartFrame + 60 && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: radius["2xl"],
                    borderBottomLeftRadius: 4,
                    backgroundColor: "#f1f3f5",
                    color: colors.foreground,
                    fontSize: 11,
                    fontFamily: fonts.body,
                    lineHeight: 1.5,
                    maxWidth: "90%",
                  }}
                >
                  <Typewriter text={AI_RESPONSE} startFrame={toolStartFrame + 65} charsPerFrame={2} />
                </div>
              </div>
            )}

            {/* Place Order button */}
            {frame >= toolStartFrame + 140 && (
              <FadeSlide startFrame={toolStartFrame + 140} direction="up" distance={8}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      padding: "6px 14px",
                      borderRadius: radius.md,
                      background: "linear-gradient(to right, #0891b2, #0d9488)",
                      color: colors.white,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: fonts.body,
                      boxShadow: `0 2px ${8 * buttonGlowOpacity}px rgba(8,145,178,${0.15 * buttonGlowOpacity})`,
                    }}
                  >
                    Place Order
                  </div>
                </div>
              </FadeSlide>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RoutingAndSupport: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const intakeFade = interpolate(frame, [40, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const doctorEnterProgress = spring({
    frame,
    fps,
    config: { damping: 20, mass: 1.5 },
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
      <FeatureCallout
        text={PROMO_CALLOUTS.routingSupport}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      {/* Intake container (left, fading out) — handoff moment */}
      {intakeFade > 0 && (
        <div
          style={{
            position: "absolute",
            left: 80,
            top: "50%",
            transform: `translateY(-50%) scale(${0.4 * doctorEnterProgress})`,
            opacity: intakeFade * doctorEnterProgress,
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 500,
              borderRadius: 12,
              overflow: "hidden",
              border: `1px solid ${colors.border}`,
              boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
              backgroundColor: colors.card,
            }}
          >
            <div
              style={{
                height: 28,
                backgroundColor: "#f5f6f8",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                gap: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FF5F57" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#27C93F" }} />
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={staticFile("favicon.ico")} style={{ width: 20, height: 20, borderRadius: 5 }} />
                <span style={{ fontFamily: fonts.display, fontSize: 10, fontWeight: 700, color: colors.cyan }}>INTAKE</span>
              </div>
              <div style={{ padding: 8, borderRadius: 8, border: "1px solid rgba(5,150,105,0.2)", backgroundColor: "rgba(5,150,105,0.04)" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>Directed to: Cardiology</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doctor workspace floating container */}
      <FloatingScreen
        enterFrame={0}
        zoomInFrame={80}
        enterFrom="right"
        widthPercent={75}
      >
        <DoctorWorkspaceContent />
      </FloatingScreen>
    </div>
  );
};
