import { useCurrentFrame } from "remotion";

export const ScanLineOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const cycleProgress = (frame % 90) / 90;
  const leftPercent = -100 + cycleProgress * 200;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${leftPercent}%`,
          width: "100%",
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(8,145,178,0.2), transparent)",
        }}
      />
    </div>
  );
};
