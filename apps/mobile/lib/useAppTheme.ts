import { useThemeStore } from "./themeStore";
import { BRAND } from "./brand";

// Static dark UI palette — structural, not brand colors
const DARK_NAVY = {
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
  overlay: "rgba(0,0,0,0.45)",
} as const;

// Crimson counterpart of DARK_NAVY, derived from BRAND.authBackground so the
// in-app UI stays consistent with the Seau de Crabe pre-login screens.
const DARK_CRIMSON = {
  bg: "#57101a",
  surface: "#6f1a26",
  surface2: "#7d2230",
  border: "#3e0c13",
  muted: "#cbb8ba",
  text: "#f8fafc",
  textSecondary: "#e8d6d3",
  textMuted: "#cbb8ba",
  inactive: "#8a5a5f",
  destructive: "#ef4444",
  overlay: "rgba(0,0,0,0.45)",
} as const;

const STRUCTURAL = BRAND.key === "seaudecrabe" ? DARK_CRIMSON : DARK_NAVY;

export function useAppTheme() {
  const { theme } = useThemeStore();
  // Locked-brand variants (theme picker hidden) always use the brand's
  // accent color, ignoring any org theme stored server-side.
  const primary = BRAND.lockedThemeKey ? BRAND.authAction : (theme?.primary ?? BRAND.authAction);
  const secondary = BRAND.lockedThemeKey ? BRAND.authAction : (theme?.secondary ?? "#64748b");

  return {
    ...STRUCTURAL,
    primary,
    secondary,
    // Derived: darker tint of primary for selected/active backgrounds
    primarySurface: primary + "33",
    primaryDark: primary + "55",
  };
}
