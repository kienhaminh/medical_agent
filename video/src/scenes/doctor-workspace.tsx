import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import { PATIENT_LIST, VISIT_BRIEF, ORDERS, SOAP_NOTE, SCENE_CALLOUTS } from "../data/script";

const URGENCY_COLORS = {
  critical: "#ef4444",
  urgent: "#f59e0b",
  routine: "#10b981",
} as const;

export const DoctorWorkspace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel slide-in progress
  const panelProgress = spring({
    frame,
    fps,
    config: { damping: 12 },
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: colors.background,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <FadeSlide startFrame={5} direction="down" distance={20}>
        <div
          style={{
            height: 52,
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            backgroundColor: colors.card,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            <div
              style={{
                padding: "6px 16px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.muted,
                color: colors.mutedForeground,
                fontSize: 13,
                fontFamily: fonts.body,
                width: 300,
              }}
            >
              Search patients...
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                  stroke={colors.mutedForeground}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: colors.cyan,
                }}
              />
            </div>
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: colors.muted,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: colors.mutedForeground,
                fontFamily: fonts.display,
              }}
            >
              DR
            </div>
          </div>
        </div>
      </FadeSlide>

      {/* 3-Zone Layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Zone A: Patient List */}
        <div
          style={{
            width: 240,
            borderRight: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * -240}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
            padding: 12,
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: colors.mutedForeground,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            My Patients
          </span>

          {PATIENT_LIST.map((patient, i) => (
            <FadeSlide key={i} startFrame={20 + i * 8} direction="left" distance={15}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${"selected" in patient && patient.selected ? "rgba(0,217,255,0.3)" : "transparent"}`,
                  backgroundColor: "selected" in patient && patient.selected ? "rgba(0,217,255,0.1)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: URGENCY_COLORS[patient.urgency],
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: colors.foreground, fontFamily: fonts.body, flex: 1 }}>
                    {patient.name}
                  </span>
                  <span style={{ fontSize: 10, color: colors.mutedForeground }}>{patient.waitMinutes}m</span>
                </div>
                <span style={{ fontSize: 11, color: colors.mutedForeground, paddingLeft: 16 }}>
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
            padding: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Patient card */}
          <FadeSlide startFrame={30} direction="up" distance={15}>
            <div
              style={{
                padding: 16,
                borderRadius: radius.lg,
                border: "1px solid rgba(0,217,255,0.2)",
                backgroundColor: colors.card,
                boxShadow: frame > 40 ? glows.cyan : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>
                    Sarah Chen
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: "rgba(245,158,11,0.15)",
                      color: colors.amber,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    URGENT
                  </span>
                </div>
                <span style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.body }}>
                  42F — Chief Complaint: Chest pain
                </span>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 12, color: colors.mutedForeground }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>128/82</div>
                  <div>BP</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>92</div>
                  <div>HR</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.foreground, fontFamily: fonts.display }}>98%</div>
                  <div>SpO2</div>
                </div>
              </div>
            </div>
          </FadeSlide>

          {/* Two columns: Brief+Orders | Notes */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            {/* Left: Brief + Orders */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Pre-visit brief */}
              <FadeSlide startFrame={60} direction="up" distance={15}>
                <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.purple} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Pre-Visit Brief</span>
                  </div>
                  <div style={{ fontSize: 13, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.6 }}>
                    <Typewriter text={VISIT_BRIEF} startFrame={70} charsPerFrame={3} />
                  </div>
                </div>
              </FadeSlide>

              {/* Orders */}
              <FadeSlide startFrame={80} direction="up" distance={15}>
                <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Orders</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ORDERS.map((order, i) => (
                      <FadeSlide key={i} startFrame={90 + i * 3} direction="up" distance={10}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: radius.md, backgroundColor: colors.muted }}>
                          <span style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.body }}>{order.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              backgroundColor: order.type === "Lab" ? "rgba(99,102,241,0.15)" : "rgba(0,184,169,0.15)",
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

            {/* Right: Clinical Notes */}
            <FadeSlide startFrame={100} direction="up" distance={15} style={{ flex: 1 }}>
              <div style={{ padding: 16, borderRadius: radius.lg, border: `1px solid ${colors.border}`, backgroundColor: colors.card, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke={colors.green} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontFamily: fonts.display, fontSize: 13, fontWeight: 600, color: colors.foreground }}>Clinical Notes</span>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, backgroundColor: "rgba(99,102,241,0.15)", color: colors.purple, marginLeft: "auto" }}>AI Draft</span>
                </div>
                <div style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.mono, lineHeight: 1.8, whiteSpace: "pre-wrap", padding: 12, borderRadius: radius.md, backgroundColor: colors.muted, minHeight: 200 }}>
                  <Typewriter text={SOAP_NOTE} startFrame={110} charsPerFrame={2} />
                </div>
              </div>
            </FadeSlide>
          </div>
        </div>

        {/* Zone C: AI Panel */}
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            transform: `translateX(${(1 - panelProgress) * 320}px)`,
            opacity: panelProgress,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Tab header */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 16px", borderBottom: `1px solid ${colors.border}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: fonts.display, fontSize: 12, fontWeight: 600, color: colors.foreground }}>AI Assistant</span>
          </div>

          {/* Mode tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${colors.border}` }}>
            {["Insights", "Chat"].map((tab, i) => (
              <div
                key={tab}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  textAlign: "center",
                  fontSize: 12,
                  fontFamily: fonts.body,
                  color: i === 0 ? colors.cyan : colors.mutedForeground,
                  borderBottom: i === 0 ? `2px solid ${colors.cyan}` : "none",
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          {/* AI content */}
          <div style={{ padding: 16 }}>
            <FadeSlide startFrame={50} direction="up" distance={10}>
              <div style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.muted, fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.body, lineHeight: 1.6 }}>
                <span style={{ color: colors.cyan, fontWeight: 600 }}>Patient Context:</span>{" "}
                Sarah Chen, 42F, presenting with acute chest pain. Cardiology referral from intake triage.
              </div>
            </FadeSlide>
          </div>
        </div>
      </div>

      {/* Feature callout */}
      <FeatureCallout text={SCENE_CALLOUTS.doctorWorkspace} position="top-center" startFrame={30} />
    </div>
  );
};
