import { useThemeStore } from "./themeStore";

// Static dark UI palette — structural, not brand colors
const DARK = {
  bg: "#0f172a",
  surface: "#1e293b",
  surface2: "#334155",
  border: "#0f172a",
  muted: "#94a3b8",
  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  inactive: "#475569",
  destructive: "#ef4444",
} as const;

export function useAppTheme() {
  const { theme } = useThemeStore();
  const primary = theme?.primary ?? "#3b82f6";
  const secondary = theme?.secondary ?? "#64748b";

  return {
    ...DARK,
    primary,
    secondary,
    // Derived: darker tint of primary for selected/active backgrounds
    primarySurface: primary + "33",
    primaryDark: primary + "55",
  };
}
