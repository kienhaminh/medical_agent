import { useCurrentFrame } from "remotion";

interface TypewriterProps {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame,
  charsPerFrame = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const displayText = text.slice(0, visibleChars);
  const showCursor = visibleChars < text.length && elapsed > 0;

  return (
    <span style={style}>
      {displayText}
      {showCursor && (
        <span style={{ opacity: Math.round((frame % 16) / 8) ? 1 : 0.3 }}>|</span>
      )}
    </span>
  );
};
