import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts } from "../styles/theme";
import { AGENT_INTRO_HEADLINES, AGENT_INTRO_FEATURES } from "../data/script";

const FeatureIcon: React.FC<{ type: "stethoscope" | "routing" | "brain" }> = ({ type }) => {
  const iconColor = colors.cyan;
  switch (type) {
    case "stethoscope":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4.8 2.655A.5.5 0 015.3 2h2.4a.5.5 0 01.5.455V6.5a4 4 0 01-8 0V2.455A.5.5 0 01.7 2h2.4a.5.5 0 01.5.455V6.5a1.5 1.5 0 003 0V2.655zM6.5 12.5v1a4 4 0 004 4h1a2 2 0 002-2v-1" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" transform="translate(4, 2)" />
          <circle cx="17.5" cy="13.5" r="2" stroke={iconColor} strokeWidth="1.5" />
        </svg>
      );
    case "routing":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="18" r="3" stroke={iconColor} strokeWidth="1.5" />
          <path d="M8.5 8.5L15.5 15.5" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="4" r="1.5" fill={iconColor} opacity="0.6" />
        </svg>
      );
  }
};

export const AgentIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Progress = spring({ frame, fps, config: { damping: 12 } });
  const line2Progress = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12 } });
  const headlineFade = interpolate(frame, [80, 100], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const featureStartFrame = 100;
  const featureDuration = 30;

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
      {headlineFade > 0 && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            opacity: headlineFade,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.foreground,
              opacity: line1Progress,
              transform: `scale(${interpolate(line1Progress, [0, 1], [0.9, 1])})`,
            }}
          >
            {AGENT_INTRO_HEADLINES.line1}
          </span>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.foreground,
              opacity: line2Progress,
              transform: `scale(${interpolate(line2Progress, [0, 1], [0.9, 1])})`,
            }}
          >
            {AGENT_INTRO_HEADLINES.line2}
          </span>
        </div>
      )}

      {frame >= featureStartFrame && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            zIndex: 10,
          }}
        >
          {AGENT_INTRO_FEATURES.map((feature, i) => {
            const featureStart = featureStartFrame + i * featureDuration;
            const featureEnd = featureStart + featureDuration;
            const isLastFeature = i === AGENT_INTRO_FEATURES.length - 1;

            const fadeIn = interpolate(frame, [featureStart, featureStart + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const fadeOut = isLastFeature ? 1 : interpolate(frame, [featureEnd - 5, featureEnd], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

            if (frame < featureStart) return null;
            if (!isLastFeature && frame > featureEnd + 5) return null;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: fadeIn * fadeOut,
                  transform: `translateY(${(1 - fadeIn) * 20}px)`,
                }}
              >
                <FeatureIcon type={feature.icon} />
                <span
                  style={{
                    fontFamily: fonts.display,
                    fontSize: 32,
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    color: colors.foreground,
                  }}
                >
                  {feature.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
