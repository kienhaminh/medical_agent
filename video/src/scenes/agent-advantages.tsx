import { useCurrentFrame, interpolate } from "remotion";
import { colors } from "../styles/theme";
import { AdvantageCard } from "../components/advantage-card";
import { AGENT_ADVANTAGES } from "../data/script";

export const AgentAdvantages: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeOut = interpolate(frame, [250, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: fadeOut,
          zIndex: 10,
        }}
      >
        {AGENT_ADVANTAGES.map((advantage, i) => (
          <AdvantageCard
            key={i}
            title={advantage.title}
            icon={advantage.icon}
            startFrame={30 + i * 20}
          />
        ))}
      </div>
    </div>
  );
};
