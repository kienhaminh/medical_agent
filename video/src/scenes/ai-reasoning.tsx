import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, glows, radius } from "../styles/theme";
import { FadeSlide } from "../components/fade-slide";
import { Typewriter } from "../components/typewriter";
import { FeatureCallout } from "../components/feature-callout";
import { AI_TOOL_CALLS, AI_RESPONSE, SCENE_CALLOUTS } from "../data/script";

export const AiReasoning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Thinking dots animation
  const thinkingVisible = frame < 60;
  const dot1Opacity = 0.3 + 0.7 * Math.sin((frame / 10) * Math.PI);
  const dot2Opacity = 0.3 + 0.7 * Math.sin(((frame - 4) / 10) * Math.PI);
  const dot3Opacity = 0.3 + 0.7 * Math.sin(((frame - 8) / 10) * Math.PI);

  // Tool call timing
  const toolStartFrame = 20;

  // Button glow pulse
  const buttonGlowOpacity = frame > 180 ? 0.5 + 0.5 * Math.sin((frame / 15) * Math.PI) : 0;

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
      {/* AI Panel — enlarged to fill most of the screen */}
      <div
        style={{
          width: 800,
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          border: `1px solid ${colors.border}`,
          boxShadow: glows.cyan,
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: `1px solid ${colors.border}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: fonts.display, fontSize: 14, fontWeight: 600, color: colors.foreground }}>
            AI Assistant — Chat
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: colors.mutedForeground }}>
            Patient: Sarah Chen
          </span>
        </div>

        {/* Chat content */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* User message */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: radius["2xl"],
                borderBottomRightRadius: 4,
                backgroundColor: "rgba(0,217,255,0.15)",
                color: colors.foreground,
                fontSize: 14,
                fontFamily: fonts.body,
                maxWidth: "75%",
              }}
            >
              Review this patient&apos;s labs and recommend next steps
            </div>
          </div>

          {/* Thinking indicator */}
          {thinkingVisible && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: radius["2xl"],
                  borderBottomLeftRadius: 4,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12, color: colors.mutedForeground }}>Analyzing</span>
                <span style={{ color: colors.cyan, opacity: dot1Opacity }}>.</span>
                <span style={{ color: colors.cyan, opacity: dot2Opacity }}>.</span>
                <span style={{ color: colors.cyan, opacity: dot3Opacity }}>.</span>
              </div>
            </div>
          )}

          {/* Tool calls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {AI_TOOL_CALLS.map((tool, i) => {
              const toolFrame = toolStartFrame + i * 10;
              const toolProgress = spring({
                frame: Math.max(0, frame - toolFrame),
                fps,
                config: { damping: 14 },
              });
              const statusFrame = toolFrame + 15;
              const isCompleted = frame >= statusFrame;

              if (frame < toolFrame) return null;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: radius.md,
                    backgroundColor: colors.muted,
                    opacity: toolProgress,
                    transform: `translateY(${(1 - toolProgress) * 15}px)`,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={colors.cyan} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 13, color: colors.foreground, fontFamily: fonts.mono, flex: 1 }}>
                    {tool.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: isCompleted ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: isCompleted ? colors.green : colors.amber,
                      fontWeight: 500,
                    }}
                  >
                    {isCompleted ? "completed" : "running..."}
                  </span>
                </div>
              );
            })}
          </div>

          {/* AI Response */}
          {frame >= 80 && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: radius["2xl"],
                  borderBottomLeftRadius: 4,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  color: colors.foreground,
                  fontSize: 14,
                  fontFamily: fonts.body,
                  lineHeight: 1.7,
                  maxWidth: "85%",
                }}
              >
                <Typewriter text={AI_RESPONSE} startFrame={85} charsPerFrame={2} />
              </div>
            </div>
          )}

          {/* Place Order button */}
          {frame >= 180 && (
            <FadeSlide startFrame={180} direction="up" distance={10}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    padding: "8px 20px",
                    borderRadius: radius.md,
                    background: "linear-gradient(to right, #00d9ff, #00b8a9)",
                    color: colors.white,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: fonts.body,
                    boxShadow: `0 0 ${20 * buttonGlowOpacity}px rgba(0,217,255,${0.3 * buttonGlowOpacity}), 0 0 ${40 * buttonGlowOpacity}px rgba(0,217,255,${0.1 * buttonGlowOpacity})`,
                  }}
                >
                  Place Order
                </div>
              </div>
            </FadeSlide>
          )}
        </div>
      </div>

      {/* Feature callout */}
      <FeatureCallout text={SCENE_CALLOUTS.aiReasoning} position="bottom-left" startFrame={70} />
    </div>
  );
};
