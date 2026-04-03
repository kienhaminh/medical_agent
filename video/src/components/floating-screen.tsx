import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, windowChrome } from "../styles/theme";

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
  /** Display variant — desktop (macOS chrome) or mobile (phone browser) */
  variant?: "desktop" | "mobile";
  /** Custom aspect ratio for the content area (default "16 / 9") */
  aspectRatio?: string;
}

/* ── Mobile browser chrome ──────────────────────────────────────── */

const MobileChrome: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      height: 44 * opacity,
      backgroundColor: "#fafbfc",
      borderBottom: `1px solid ${colors.border}`,
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 8,
      overflow: "hidden",
      opacity,
    }}
  >
    {/* Status bar icons (time, signal, battery) */}
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.foreground,
          fontFamily: fonts.body,
        }}
      >
        9:41
      </span>
    </div>

    {/* URL bar */}
    <div
      style={{
        flex: 3,
        height: 26,
        borderRadius: 8,
        backgroundColor: colors.muted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke={colors.mutedForeground} strokeWidth="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" stroke={colors.mutedForeground} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontSize: 9,
          color: colors.mutedForeground,
          fontFamily: fonts.body,
          fontWeight: 500,
        }}
      >
        medera.health
      </span>
    </div>

    {/* Right status icons */}
    <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, justifyContent: "flex-end" }}>
      {/* Signal bars */}
      <svg width="12" height="10" viewBox="0 0 16 12" fill="none">
        <rect x="0" y="9" width="3" height="3" rx="0.5" fill={colors.foreground} />
        <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill={colors.foreground} />
        <rect x="9" y="3" width="3" height="9" rx="0.5" fill={colors.foreground} />
        <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill={colors.foreground} opacity="0.3" />
      </svg>
      {/* Battery */}
      <svg width="18" height="9" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={colors.foreground} strokeWidth="1" />
        <rect x="2" y="2" width="14" height="8" rx="1" fill={colors.green} />
        <rect x="22" y="3.5" width="2.5" height="5" rx="1" fill={colors.foreground} opacity="0.4" />
      </svg>
    </div>
  </div>
);

/* ── Desktop (macOS) chrome ─────────────────────────────────────── */

const DesktopChrome: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      height: windowChrome.titleBarHeight * opacity,
      backgroundColor: windowChrome.titleBarBg,
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: windowChrome.dotGap,
      overflow: "hidden",
      opacity,
      borderBottom: opacity > 0.1 ? `1px solid ${windowChrome.containerBorder}` : "none",
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
);

/* ── Main component ─────────────────────────────────────────────── */

export const FloatingScreen: React.FC<FloatingScreenProps> = ({
  children,
  enterFrame = 0,
  zoomInFrame,
  zoomOutFrame,
  exitFrame,
  widthPercent = 75,
  enterFrom = "bottom",
  variant = "desktop",
  aspectRatio = "16 / 9",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerWidth = (1920 * widthPercent) / 100;
  // Parse aspect ratio to compute height
  const [arW, arH] = aspectRatio.split("/").map((s) => parseFloat(s.trim()));
  const containerHeight = containerWidth * (arH / arW);

  // --- Entrance animation ---
  const enterProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 20, mass: 1.5 },
  });

  // --- Zoom animation ---
  let zoomProgress = 0;
  if (zoomInFrame !== undefined) {
    const zoomInP = spring({
      frame: Math.max(0, frame - zoomInFrame),
      fps,
      config: { damping: 22, mass: 1.8 },
    });
    zoomProgress = zoomInP;
  }
  if (zoomOutFrame !== undefined && frame >= zoomOutFrame) {
    const zoomOutP = spring({
      frame: Math.max(0, frame - zoomOutFrame),
      fps,
      config: { damping: 22, mass: 1.8 },
    });
    zoomProgress = 1 - zoomOutP;
  }

  // --- Exit animation ---
  let exitProgress = 1;
  if (exitFrame !== undefined) {
    exitProgress = interpolate(frame, [exitFrame, exitFrame + 20], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // --- Compute transforms ---
  const scaleX = interpolate(zoomProgress, [0, 1], [1, 1920 / containerWidth]);
  const scaleY = interpolate(zoomProgress, [0, 1], [1, 1080 / containerHeight]);
  const scale = Math.min(scaleX, scaleY);

  const chromeOpacity = interpolate(zoomProgress, [0, 0.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOffset = {
    bottom: { x: 0, y: (1 - enterProgress) * 200 },
    left: { x: (enterProgress - 1) * 200, y: 0 },
    right: { x: (1 - enterProgress) * 200, y: 0 },
  }[enterFrom];

  const enterScale = interpolate(enterProgress, [0, 1], [0.95, 1]);

  if (frame < enterFrame) return null;

  const isMobile = variant === "mobile";

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
          borderRadius: isMobile ? 32 : windowChrome.borderRadius,
          overflow: "hidden",
          border: `1px solid ${windowChrome.containerBorder}`,
          boxShadow: chromeOpacity > 0.01 ? windowChrome.containerShadow : "none",
          backgroundColor: colors.card,
        }}
      >
        {/* Chrome */}
        {isMobile ? (
          <MobileChrome opacity={chromeOpacity} />
        ) : (
          <DesktopChrome opacity={chromeOpacity} />
        )}

        {/* Content area */}
        <div
          style={{
            width: "100%",
            aspectRatio,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>

        {/* Mobile home indicator bar */}
        {isMobile && chromeOpacity > 0.01 && (
          <div
            style={{
              height: 20 * chromeOpacity,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fafbfc",
              overflow: "hidden",
              opacity: chromeOpacity,
            }}
          >
            <div
              style={{
                width: 100,
                height: 4,
                borderRadius: 99,
                backgroundColor: colors.border,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
