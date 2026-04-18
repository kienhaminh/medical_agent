import { DotMatrixBg } from "../components/dot-matrix-bg";
import { FeatureCallout } from "../components/feature-callout";
import { FloatingScreen } from "../components/floating-screen";
import { KpiBar } from "../components/kpi-bar";
import { KanbanBoard } from "../components/kanban-board";
import { SCENE_CALLOUTS, KPI_METRICS, KANBAN_COLUMNS } from "../data/script";

export const AdminDashboard: React.FC = () => {
  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#f8f9fb",
      }}
    >
      <DotMatrixBg fadeInFrames={0} opacity={0.06} />

      <FeatureCallout
        text={SCENE_CALLOUTS.hospitalOps}
        position="top-center"
        startFrame={10}
        endFrame={50}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        <FloatingScreen enterFrame={0} widthPercent={84} variant="desktop">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              padding: 24,
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            <KpiBar metrics={KPI_METRICS} enterFrame={20} countDuration={30} />
            <KanbanBoard
              columns={KANBAN_COLUMNS}
              enterFrame={60}
              moveStartFrame={170}
              moveDuration={30}
            />
          </div>
        </FloatingScreen>
      </div>
    </div>
  );
};
