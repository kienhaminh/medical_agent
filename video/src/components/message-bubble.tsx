import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts, radius } from "../styles/theme";
import { Typewriter } from "./typewriter";

interface MessageBubbleProps {
  role: "user" | "assistant";
  text: string;
  startFrame: number;
  typewriter?: boolean;
  charsPerFrame?: number;
  /** Font size override (default 16) */
  fontSize?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  text,
  startFrame,
  typewriter = false,
  charsPerFrame = 2,
  fontSize = 16,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isUser = role === "user";

  const slideProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 18, mass: 1.1 },
  });

  const slideX = isUser ? (1 - slideProgress) * 50 : (slideProgress - 1) * 50;

  // Scale padding relative to font size
  const padV = Math.round(fontSize * 0.55);
  const padH = Math.round(fontSize * 0.9);

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
          maxWidth: "75%",
          padding: `${padV}px ${padH}px`,
          borderRadius: radius["2xl"],
          borderBottomRightRadius: isUser ? 4 : radius["2xl"],
          borderBottomLeftRadius: isUser ? radius["2xl"] : 4,
          backgroundColor: isUser
            ? "rgba(8,145,178,0.08)"
            : "#f1f3f5",
          color: colors.foreground,
          fontSize,
          fontFamily: fonts.body,
          lineHeight: 1.5,
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
