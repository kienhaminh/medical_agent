import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { colors, fonts, radius } from "../styles/theme";

interface KanbanCardData {
  readonly name: string;
  readonly dept: string;
  readonly wait: string;
  readonly highlight?: boolean;
  readonly movesOut?: true;
  readonly movesIn?: true;
}

interface KanbanColumnData {
  readonly title: string;
  readonly color: string;
  readonly cards: readonly KanbanCardData[];
}

interface KanbanBoardProps {
  columns: readonly KanbanColumnData[];
  enterFrame?: number;
  moveStartFrame?: number;
  moveDuration?: number;
}

const KanbanCard: React.FC<{
  card: KanbanCardData;
  enterFrame: number;
  moveStartFrame: number;
  moveDuration: number;
}> = ({ card, enterFrame, moveStartFrame, moveDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: Math.max(0, frame - enterFrame),
    fps,
    config: { damping: 18, mass: 1 },
  });

  const entryOpacity = interpolate(entryProgress, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const moveOutOpacity = card.movesOut
    ? interpolate(frame, [moveStartFrame, moveStartFrame + 15], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const moveInOpacity = card.movesIn
    ? interpolate(frame, [moveStartFrame + 10, moveStartFrame + moveDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const finalOpacity = entryOpacity * moveOutOpacity * moveInOpacity;
  const translateY = interpolate(entryProgress, [0, 1], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: finalOpacity,
        transform: `translateY(${translateY}px)`,
        background: card.highlight ? "rgba(8,145,178,0.07)" : colors.card,
        border: `1px solid ${card.highlight ? "rgba(8,145,178,0.3)" : colors.border}`,
        borderRadius: radius.md,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.foreground, fontFamily: fonts.body }}>
        {card.name}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.body }}>
          {card.dept}
        </span>
        <span style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.display }}>
          {card.wait}
        </span>
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  enterFrame = 0,
  moveStartFrame = 170,
  moveDuration = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", gap: 12, width: "100%" }}>
      {columns.map((col, ci) => {
        const colEnter = enterFrame + ci * 8;
        const colProgress = spring({
          frame: Math.max(0, frame - colEnter),
          fps,
          config: { damping: 20, mass: 1.2 },
        });
        const colOpacity = interpolate(colProgress, [0, 0.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const colY = interpolate(colProgress, [0, 1], [18, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={ci}
            style={{
              flex: 1,
              opacity: colOpacity,
              transform: `translateY(${colY}px)`,
              background: "#f1f3f5",
              borderRadius: radius.xl,
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: col.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: col.color,
                  fontFamily: fonts.display,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {col.title}
              </span>
            </div>

            {col.cards.map((card, ki) => (
              <KanbanCard
                key={ki}
                card={card}
                enterFrame={colEnter + 12 + ki * 6}
                moveStartFrame={moveStartFrame}
                moveDuration={moveDuration}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
