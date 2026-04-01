import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

type IconType = "stethoscope" | "routing" | "brain";

interface AdvantageCardProps {
  title: string;
  icon: IconType;
  startFrame: number;
}

const IconSvg: React.FC<{ type: IconType }> = ({ type }) => {
  const iconColor = colors.cyan;
  const size = 28;

  switch (type) {
    case "stethoscope":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M4.8 2.655A.5.5 0 015.3 2h2.4a.5.5 0 01.5.455V6.5a4 4 0 01-8 0V2.455A.5.5 0 01.7 2h2.4a.5.5 0 01.5.455V6.5a1.5 1.5 0 003 0V2.655zM6.5 12.5v1a4 4 0 004 4h1a2 2 0 002-2v-1"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            transform="translate(4, 2)"
          />
          <circle cx="17.5" cy="13.5" r="2" stroke={iconColor} strokeWidth="1.5" />
        </svg>
      );
    case "routing":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="6" r="3" stroke={iconColor} strokeWidth="1.5" />
          <circle cx="18" cy="18" r="3" stroke={iconColor} strokeWidth="1.5" />
          <path d="M9 6h6M18 9v6M6 9v3c0 3.314 2.686 6 6 6h3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "brain":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z"
            stroke={iconColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M10 21h4M9 17v-3M15 17v-3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
          {/* Sparkle */}
          <circle cx="20" cy="4" r="1.5" fill={iconColor} opacity="0.6" />
          <line x1="20" y1="1" x2="20" y2="2" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="20" y1="6" x2="20" y2="7" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="17" y1="4" x2="18" y2="4" stroke={iconColor} strokeWidth="1" opacity="0.6" />
          <line x1="22" y1="4" x2="23" y2="4" stroke={iconColor} strokeWidth="1" opacity="0.6" />
        </svg>
      );
  }
};

export const AdvantageCard: React.FC<AdvantageCardProps> = ({
  title,
  icon,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14 },
  });

  const scale = interpolate(progress, [0, 1], [0.95, 1]);

  if (frame < startFrame) return null;

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * 30}px) scale(${scale})`,
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "20px 28px",
        borderRadius: radius.xl,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
        minWidth: 380,
      }}
    >
      <IconSvg type={icon} />
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "0.05em",
          color: colors.foreground,
        }}
      >
        {title}
      </span>
    </div>
  );
};
