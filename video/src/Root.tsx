import { Composition, staticFile } from "remotion";
import { DemoVideo } from "./DemoVideo";

// Font face declarations loaded via style element
// staticFile() serves files from the public/ directory
const fontStyles = [
  "@font-face {",
  "  font-family: 'JetBrains Mono';",
  `  src: url('${staticFile("fonts/JetBrainsMono-VariableFont_wght.ttf")}') format('truetype');`,
  "  font-weight: 100 800;",
  "  font-display: block;",
  "}",
].join("\n");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <style>{fontStyles}</style>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
