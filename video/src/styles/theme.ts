// Color tokens mapped from web/app/globals.css Clinical Futurism dark theme
// oklch values converted to hex for inline styles

export const colors = {
  background: "#141414",
  foreground: "#f0f0f0",
  card: "#1a1a1a",
  border: "#303030",
  muted: "#242424",
  mutedForeground: "#999999",
  cyan: "#00d9ff",
  teal: "#00b8a9",
  purple: "#6366f1",
  green: "#10b981",
  emerald: "#10b981",
  navy: "#0a0e27",
  amber: "#f59e0b",
  red: "#ef4444",
  white: "#ffffff",
} as const;

export const fonts = {
  display: "JetBrains Mono, monospace",
  body: "Geist Sans, system-ui, sans-serif",
  mono: "Geist Mono, monospace",
} as const;

export const glows = {
  cyan: "0 0 20px rgba(0,217,255,0.3), 0 0 40px rgba(0,217,255,0.1)",
  teal: "0 0 15px rgba(0,184,169,0.3), 0 0 30px rgba(0,184,169,0.1)",
  emerald: "0 0 15px rgba(16,185,129,0.3), 0 0 30px rgba(16,185,129,0.1)",
  cyanBorder: "inset 0 0 15px rgba(0,217,255,0.1)",
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
} as const;

export const gradients = {
  cyanToTeal: "linear-gradient(to right, #00d9ff, #00b8a9)",
  cyanToTealBg: "linear-gradient(to right, #00d9ff, #00b8a9)",
  scanLine: "linear-gradient(90deg, transparent, rgba(0,217,255,0.7), transparent)",
  dotMatrix: "radial-gradient(circle, rgba(0,217,255,0.1) 1px, transparent 1px)",
} as const;
