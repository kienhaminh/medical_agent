import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, radius } from "../styles/theme";
import { Typewriter } from "./typewriter";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  startFrame: number;
  typewriter?: boolean;
  charsPerFrame?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  text,
  startFrame,
  typewriter = false,
  charsPerFrame = 2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isUser = role === "user";

  const slideProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12 },
  });

  const slideX = isUser ? (1 - slideProgress) * 50 : (slideProgress - 1) * 50;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity: slideProgress,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 16px",
          borderRadius: radius["2xl"],
          borderBottomRightRadius: isUser ? 4 : radius["2xl"],
          borderBottomLeftRadius: isUser ? radius["2xl"] : 4,
          backgroundColor: isUser
            ? "rgba(0,217,255,0.15)"
            : "rgba(255,255,255,0.06)",
          color: colors.foreground,
          fontSize: 14,
          fontFamily: fonts.body,
          lineHeight: 1.6,
        }}
      >
        {typewriter ? (
          <Typewriter
            text={text}
            startFrame={startFrame + 8}
            charsPerFrame={charsPerFrame}
          />
        ) : (
          text
        )}
      </div>
    </div>
  );
};
