import { useCurrentFrame, interpolate } from "remotion";
import { fonts } from "../styles/theme";

interface MriVisualizationProps {
  baseEnterFrame?: number;
  overlayEnterFrame?: number;
  metadataEnterFrame?: number;
  metadataText?: string;
}

export const MriVisualization: React.FC<MriVisualizationProps> = ({
  baseEnterFrame = 0,
  overlayEnterFrame = 30,
  metadataEnterFrame = 130,
  metadataText = "Slice 78/155 · Tumor coverage: 12.4%",
}) => {
  const frame = useCurrentFrame();

  const baseOpacity = interpolate(frame, [baseEnterFrame, baseEnterFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Each overlay layer grows via expanding clip circle
  const layerProgress = (delayFrames: number) =>
    interpolate(
      frame,
      [overlayEnterFrame + delayFrames, overlayEnterFrame + delayFrames + 45],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  const clip0R = layerProgress(0) * 320;   // Necrotic Core
  const clip1R = layerProgress(20) * 320;  // Peritumoral Edema
  const clip2R = layerProgress(40) * 320;  // Enhancing Tumor

  const metaOpacity = interpolate(frame, [metadataEnterFrame, metadataEnterFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 420, height: 420, opacity: baseOpacity }}>
        <svg
          width={420}
          height={420}
          viewBox="0 0 420 420"
          style={{ borderRadius: 12, overflow: "hidden" }}
        >
          <defs>
            <radialGradient id="brainBase" cx="50%" cy="44%" r="50%">
              <stop offset="0%" stopColor="#3a3a50" />
              <stop offset="45%" stopColor="#252535" />
              <stop offset="75%" stopColor="#181828" />
              <stop offset="100%" stopColor="#0a0e17" />
            </radialGradient>
            <clipPath id="mriClip0">
              <circle cx="210" cy="200" r={clip0R} />
            </clipPath>
            <clipPath id="mriClip1">
              <circle cx="210" cy="200" r={clip1R} />
            </clipPath>
            <clipPath id="mriClip2">
              <circle cx="210" cy="200" r={clip2R} />
            </clipPath>
          </defs>

          {/* Dark brain background */}
          <rect width={420} height={420} fill="url(#brainBase)" rx={12} />

          {/* Skull/brain outline */}
          <ellipse cx={210} cy={210} rx={185} ry={200} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />

          {/* Cortical surface rings */}
          <ellipse cx={210} cy={205} rx={148} ry={163} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={7} />
          <ellipse cx={210} cy={203} rx={110} ry={125} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={5} />
          <ellipse cx={210} cy={200} rx={72} ry={85} fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth={4} />

          {/* Central sulcus / fissure lines */}
          <path d="M210 22 Q198 110 210 210" stroke="rgba(0,0,0,0.35)" strokeWidth={2} fill="none" />
          <path d="M125 85 Q155 160 135 230" stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} fill="none" />
          <path d="M295 85 Q265 160 285 230" stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} fill="none" />
          <path d="M80 200 Q160 185 210 210" stroke="rgba(0,0,0,0.15)" strokeWidth={1} fill="none" />

          {/* Peritumoral Edema — largest, renders below enhancing tumor */}
          <ellipse
            cx={218} cy={203} rx={98} ry={88}
            fill="#22c55e"
            fillOpacity={0.4}
            clipPath="url(#mriClip1)"
          />
          {/* Enhancing Tumor ring */}
          <ellipse
            cx={210} cy={197} rx={72} ry={65}
            fill="#3b82f6"
            fillOpacity={0.5}
            clipPath="url(#mriClip2)"
          />
          {/* Necrotic Core — smallest, on top */}
          <ellipse
            cx={210} cy={197} rx={46} ry={40}
            fill="#dc2626"
            fillOpacity={0.65}
            clipPath="url(#mriClip0)"
          />

          {/* Outer frame */}
          <rect
            width={420}
            height={420}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
            rx={12}
          />
        </svg>
      </div>

      {/* Metadata line */}
      <div
        style={{
          opacity: metaOpacity,
          fontSize: 13,
          color: "#94a3b8",
          fontFamily: fonts.display,
          letterSpacing: "0.06em",
        }}
      >
        {metadataText}
      </div>
    </div>
  );
};
