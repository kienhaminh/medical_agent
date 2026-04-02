import { useCurrentFrame, spring, useVideoConfig } from "remotion";

interface FadeSlideProps {
  children: React.ReactNode;
  startFrame: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  style?: React.CSSProperties;
}

export const FadeSlide: React.FC<FadeSlideProps> = ({
  children,
  startFrame,
  direction = "up",
  distance = 30,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 18, mass: 1.2 },
  });

  const translate = {
    up: `translateY(${(1 - progress) * distance}px)`,
    down: `translateY(${(progress - 1) * distance}px)`,
    left: `translateX(${(1 - progress) * distance}px)`,
    right: `translateX(${(progress - 1) * distance}px)`,
  }[direction];

  return (
    <div
      style={{
        opacity: progress,
        transform: translate,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
