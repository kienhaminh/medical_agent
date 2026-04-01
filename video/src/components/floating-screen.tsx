import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, windowChrome } from "../styles/theme";

interface FloatingScreenProps {
  children: React.ReactNode;
  /** Frame when the container slides into view */
  enterFrame?: number;
  /** Frame when zoom-in starts (chrome fades, content fills) */
  zoomInFrame?: number;
  /** Frame when zoom-out starts (content shrinks back into container) */
  zoomOutFrame?: number;
  /** Frame when the container exits */
  exitFrame?: number;
  /** Width as percentage of 1920px frame */
  widthPercent?: number;
  /** Entrance direction */
  enterFrom?: "bottom" | "left" | "right";
}

export const FloatingScreen: React.FC<FloatingScreenProps> = ({
  children,
  enterFrame = 0,
  zoomInFrame,
  zoomOutFrame,
  exitFrame,
  widthPercent = 75,
  enterFrom = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerWidth = (1920 * widthPercent) / 100;
  const containerHeight = containerWidth * (9 / 16); // 16:9 aspect

  // --- Entrance animation ---
  const enterProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 14 },
  });

  // --- Zoom animation ---
  // zoomProgress: 0 = framed view, 1 = full screen
  let zoomProgress = 0;
  if (zoomInFrame !== undefined) {
    const zoomInP = spring({
      frame: Math.max(0, frame - zoomInFrame),
      fps,
      config: { damping: 12 },
    });
    zoomProgress = zoomInP;
  }
  if (zoomOutFrame !== undefined && frame >= zoomOutFrame) {
    const zoomOutP = spring({
      frame: Math.max(0, frame - zoomOutFrame),
      fps,
      config: { damping: 12 },
    });
    zoomProgress = 1 - zoomOutP;
  }

  // --- Exit animation ---
  let exitProgress = 1; // 1 = visible, 0 = gone
  if (exitFrame !== undefined) {
    exitProgress = interpolate(frame, [exitFrame, exitFrame + 15], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // --- Compute transforms ---
  // Scale from container size to full screen
  const scaleX = interpolate(zoomProgress, [0, 1], [1, 1920 / containerWidth]);
  const scaleY = interpolate(zoomProgress, [0, 1], [1, 1080 / containerHeight]);
  const scale = Math.min(scaleX, scaleY);

  // Chrome opacity fades out during zoom
  const chromeOpacity = interpolate(zoomProgress, [0, 0.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Entrance slide offset
  const enterOffset = {
    bottom: { x: 0, y: (1 - enterProgress) * 200 },
    left: { x: (enterProgress - 1) * 200, y: 0 },
    right: { x: (1 - enterProgress) * 200, y: 0 },
  }[enterFrom];

  // Scale bump on entrance
  const enterScale = interpolate(enterProgress, [0, 1], [0.95, 1]);

  if (frame < enterFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        opacity: enterProgress * exitProgress,
        transform: `translate(${enterOffset.x}px, ${enterOffset.y}px) scale(${enterScale * scale})`,
      }}
    >
      <div
        style={{
          width: containerWidth,
          borderRadius: windowChrome.borderRadius,
          overflow: "hidden",
          border: `1px solid ${windowChrome.containerBorder}`,
          boxShadow: chromeOpacity > 0.01 ? windowChrome.containerShadow : "none",
          backgroundColor: colors.card,
        }}
      >
        {/* Window chrome title bar */}
        <div
          style={{
            height: windowChrome.titleBarHeight * chromeOpacity,
            backgroundColor: windowChrome.titleBarBg,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: windowChrome.dotGap,
            overflow: "hidden",
            opacity: chromeOpacity,
            borderBottom: chromeOpacity > 0.1 ? `1px solid ${windowChrome.containerBorder}` : "none",
          }}
        >
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficRed,
            }}
          />
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficYellow,
            }}
          />
          <div
            style={{
              width: windowChrome.dotSize,
              height: windowChrome.dotSize,
              borderRadius: "50%",
              backgroundColor: windowChrome.trafficGreen,
            }}
          />
        </div>

        {/* Content area */}
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
