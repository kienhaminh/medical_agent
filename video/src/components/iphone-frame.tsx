import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts } from "../styles/theme";

/* ── iPhone 14 physical dimensions (logical) ────────────────────
 * Screen:  390 × 844 pts  →  ratio ≈ 1 : 2.164
 * We render at a fixed width and derive height from ratio.
 * Bezel: 12px all around, corner radius 47px (Apple spec).
 * Dynamic Island: 126 × 37 pts, centered.
 * ─────────────────────────────────────────────────────────────── */

const BEZEL = 10;
const OUTER_RADIUS = 47;
const INNER_RADIUS = OUTER_RADIUS - BEZEL;
const ISLAND_W = 126;
const ISLAND_H = 34;

interface IphoneFrameProps {
  children: React.ReactNode;
  /** Pixel width of the device on the 1920×1080 canvas */
  width?: number;
  /** Frame when it enters */
  enterFrame?: number;
  /** Entrance direction */
  enterFrom?: "bottom" | "left" | "right";
  /** Frame when zoom-in starts (chrome fades, content fills screen) */
  zoomInFrame?: number;
}

export const IphoneFrame: React.FC<IphoneFrameProps> = ({
  children,
  width = 390,
  enterFrame = 0,
  enterFrom = "bottom",
  zoomInFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenW = width - BEZEL * 2;
  const screenH = screenW * 2.164; // iPhone 14 ratio
  const deviceH = screenH + BEZEL * 2;

  /* ── Enter animation ──────────────────────────────────────────── */
  const enterProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 20, mass: 1.5 },
  });

  const enterOffset = {
    bottom: { x: 0, y: (1 - enterProgress) * 200 },
    left: { x: (enterProgress - 1) * 200, y: 0 },
    right: { x: (1 - enterProgress) * 200, y: 0 },
  }[enterFrom];

  const enterScale = interpolate(enterProgress, [0, 1], [0.95, 1]);

  /* ── Zoom animation ───────────────────────────────────────────── */
  let zoomProgress = 0;
  if (zoomInFrame !== undefined) {
    zoomProgress = spring({
      frame: Math.max(0, frame - zoomInFrame),
      fps,
      config: { damping: 22, mass: 1.8 },
    });
  }

  const scaleToFill = Math.min(1920 / width, 1080 / deviceH);
  const scale = interpolate(zoomProgress, [0, 1], [1, scaleToFill]);

  const chromeOpacity = interpolate(zoomProgress, [0, 0.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        opacity: enterProgress,
        transform: `translate(${enterOffset.x}px, ${enterOffset.y}px) scale(${enterScale * scale})`,
      }}
    >
      {/* Device shell */}
      <div
        style={{
          width,
          height: deviceH,
          borderRadius: OUTER_RADIUS,
          backgroundColor: "#1a1d23",
          padding: BEZEL,
          boxShadow: chromeOpacity > 0.01
            ? "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)"
            : "none",
          position: "relative",
        }}
      >
        {/* Side button (right) */}
        {chromeOpacity > 0.01 && (
          <>
            <div
              style={{
                position: "absolute",
                right: -2,
                top: 140,
                width: 3,
                height: 54,
                borderRadius: "0 2px 2px 0",
                backgroundColor: "#2a2d33",
                opacity: chromeOpacity,
              }}
            />
            {/* Volume buttons (left) */}
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 120,
                width: 3,
                height: 28,
                borderRadius: "2px 0 0 2px",
                backgroundColor: "#2a2d33",
                opacity: chromeOpacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -2,
                top: 160,
                width: 3,
                height: 28,
                borderRadius: "2px 0 0 2px",
                backgroundColor: "#2a2d33",
                opacity: chromeOpacity,
              }}
            />
          </>
        )}

        {/* Screen area */}
        <div
          style={{
            width: screenW,
            height: screenH,
            borderRadius: INNER_RADIUS,
            overflow: "hidden",
            position: "relative",
            backgroundColor: "#fff",
          }}
        >
          {/* Dynamic Island */}
          {chromeOpacity > 0.01 && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                width: ISLAND_W,
                height: ISLAND_H,
                borderRadius: ISLAND_H / 2,
                backgroundColor: "#1a1d23",
                zIndex: 50,
                opacity: chromeOpacity,
              }}
            />
          )}

          {/* Status bar */}
          <div
            style={{
              position: "relative",
              zIndex: 40,
              height: 50,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              padding: "0 20px 4px",
              backgroundColor: "#fafbfc",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: colors.foreground,
                fontFamily: fonts.body,
              }}
            >
              9:41
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Signal */}
              <svg width="14" height="10" viewBox="0 0 16 12" fill="none">
                <rect x="0" y="9" width="3" height="3" rx="0.5" fill={colors.foreground} />
                <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill={colors.foreground} />
                <rect x="9" y="3" width="3" height="9" rx="0.5" fill={colors.foreground} />
                <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill={colors.foreground} opacity="0.3" />
              </svg>
              {/* Battery */}
              <svg width="20" height="10" viewBox="0 0 25 12" fill="none">
                <rect x="0.5" y="0.5" width="21" height="11" rx="2" stroke={colors.foreground} strokeWidth="1" />
                <rect x="2" y="2" width="14" height="8" rx="1" fill={colors.green} />
                <rect x="22" y="3.5" width="2.5" height="5" rx="1" fill={colors.foreground} opacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div style={{ position: "relative", width: "100%", height: screenH - 50 - 28, overflow: "hidden" }}>
            {children}
          </div>

          {/* Home indicator */}
          <div
            style={{
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fafbfc",
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
        </div>
      </div>
    </div>
  );
};
