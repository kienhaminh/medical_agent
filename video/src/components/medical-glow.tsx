import { glows } from "../styles/theme";

type GlowVariant = "cyan" | "teal" | "emerald";

interface MedicalGlowProps {
  variant: GlowVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const MedicalGlow: React.FC<MedicalGlowProps> = ({
  variant,
  children,
  style,
}) => {
  return (
    <div style={{ boxShadow: glows[variant], ...style }}>
      {children}
    </div>
  );
};
