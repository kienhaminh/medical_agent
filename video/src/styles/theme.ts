// Light professional theme — clean whites, subtle grays, cyan/teal accents
// Designed for a polished healthcare SaaS promo

export const colors = {
  background: "#f8f9fb",
  foreground: "#1a1d23",
  card: "#ffffff",
  border: "#e2e5ea",
  muted: "#f1f3f5",
  mutedForeground: "#6b7280",
  cyan: "#0891b2",
  teal: "#0d9488",
  purple: "#6366f1",
  green: "#059669",
  emerald: "#059669",
  navy: "#1e293b",
  amber: "#d97706",
  red: "#dc2626",
  white: "#ffffff",
} as const;

export const fonts = {
  display: "JetBrains Mono, monospace",
  body: "Geist Sans, system-ui, sans-serif",
  mono: "Geist Mono, monospace",
} as const;

export const glows = {
  cyan: "0 2px 12px rgba(8,145,178,0.12), 0 0 0 1px rgba(8,145,178,0.08)",
  teal: "0 2px 12px rgba(13,148,136,0.12), 0 0 0 1px rgba(13,148,136,0.08)",
  emerald: "0 2px 12px rgba(5,150,105,0.12), 0 0 0 1px rgba(5,150,105,0.08)",
  cyanBorder: "inset 0 0 8px rgba(8,145,178,0.06)",
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
} as const;

export const gradients = {
  cyanToTeal: "linear-gradient(to right, #0891b2, #0d9488)",
  cyanToTealBg: "linear-gradient(to right, #0891b2, #0d9488)",
  scanLine: "linear-gradient(90deg, transparent, rgba(8,145,178,0.25), transparent)",
  dotMatrix: "radial-gradient(circle, rgba(8,145,178,0.06) 1px, transparent 1px)",
} as const;

export const windowChrome = {
  trafficRed: "#FF5F57",
  trafficYellow: "#FFBD2E",
  trafficGreen: "#27C93F",
  titleBarBg: "#f5f6f8",
  containerBorder: "#dde0e4",
  containerShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
  dotSize: 8,
  dotGap: 8,
  titleBarHeight: 32,
  borderRadius: 12,
} as const;
