import { Composition, registerRoot, staticFile } from "remotion";
import { DemoVideo } from "./DemoVideo";

const fontStyles = [
  "@font-face {",
  "  font-family: 'JetBrains Mono';",
  `  src: url('${staticFile("fonts/JetBrainsMono-VariableFont_wght.ttf")}') format('truetype');`,
  "  font-weight: 100 800;",
  "  font-display: block;",
  "}",
].join("\n");

const RemotionRoot: React.FC = () => {
  return (
    <>
      <style>{fontStyles}</style>
      <Composition
        id="DemoVideo"
        component={DemoVideo}
        durationInFrames={2250}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
