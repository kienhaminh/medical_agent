import { useCurrentFrame, interpolate } from "remotion";
import { ParticleNetwork } from "../components/particle-network";
import { FeatureCallout } from "../components/feature-callout";
import { Typewriter } from "../components/typewriter";
import { ProcessingIndicator } from "../components/processing-indicator";
import { MriVisualization } from "../components/mri-visualization";
import { SegmentationLegend } from "../components/segmentation-legend";
import {
  SCENE_CALLOUTS,
  MRI_COMMAND,
  MRI_PROCESSING_TEXT,
  MRI_PROCESSING_SUBTEXT,
  MRI_METADATA,
  MRI_LEGEND,
} from "../data/script";
import { fonts } from "../styles/theme";

export const MriSegmentation: React.FC = () => {
  const frame = useCurrentFrame();

  const processingOpacity = interpolate(frame, [80, 90, 120, 130], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const vizOpacity = interpolate(frame, [128, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#0a0e17",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.12 }}>
        <ParticleNetwork opacity={1} fadeInFrames={30} />
      </div>

      <FeatureCallout
        text={SCENE_CALLOUTS.mriSegmentation}
        position="top-center"
        startFrame={10}
        endFrame={55}
      />

      {frame >= 20 && (
        <div
          style={{
            position: "absolute",
            top: 120,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px 24px",
            zIndex: 2,
          }}
        >
          <Typewriter
            text={MRI_COMMAND}
            startFrame={20}
            charsPerFrame={2.5}
            style={{
              color: "#e2e8f0",
              fontSize: 16,
              fontFamily: fonts.body,
              whiteSpace: "nowrap",
            }}
          />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: processingOpacity,
          zIndex: 2,
        }}
      >
        <ProcessingIndicator
          text={MRI_PROCESSING_TEXT}
          subtext={MRI_PROCESSING_SUBTEXT}
          color="#0891b2"
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -44%)",
          opacity: vizOpacity,
          display: "flex",
          alignItems: "flex-start",
          gap: 48,
          zIndex: 2,
        }}
      >
        <MriVisualization
          baseEnterFrame={0}
          overlayEnterFrame={30}
          metadataEnterFrame={130}
          metadataText={MRI_METADATA}
        />
        <SegmentationLegend items={MRI_LEGEND} enterFrame={110} />
      </div>
    </div>
  );
};
