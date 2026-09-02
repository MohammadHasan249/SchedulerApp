import Constants from "expo-constants";

export type BrandConfig = {
  key: "workplix" | "seaudecrabe";
  displayName: string;
  /** When set, org signup is disabled and employees join this org only. */
  lockedOrgSlug: string | null;
  /** When set, theme is fixed and the in-app theme picker is hidden. */
  lockedThemeKey: string | null;
  /** Background color for the pre-login auth screens (login, signup). */
  authBackground: string;
  /** Input field background on the pre-login auth screens. */
  authInputBg: string;
  /** Input field border on the pre-login auth screens. */
  authInputBorder: string;
  /** Secondary/label/hint text color on the pre-login auth screens. */
  authMuted: string;
  /** Primary button background on the pre-login auth screens. */
  authAction: string;
  /** Primary button text color on the pre-login auth screens. */
  authActionText: string;
};

export const BRANDS: Record<BrandConfig["key"], BrandConfig> = {
  workplix: {
    key: "workplix",
    displayName: "Workplix",
    lockedOrgSlug: null,
    lockedThemeKey: null,
    authBackground: "#0f172a",
    authInputBg: "#1e293b",
    authInputBorder: "#334155",
    authMuted: "#94a3b8",
    authAction: "#3b82f6",
    authActionText: "#ffffff",
  },
  seaudecrabe: {
    key: "seaudecrabe",
    displayName: "Seau de Crabe",
    lockedOrgSlug: "seau-de-crabe",
    lockedThemeKey: "crimson",
    // Deep wine-red rather than the earlier neon crimson — the input
    // fields below are translucent white derived from this same red, so a
    // saturated ground would blow them out.
    authBackground: "#57101a",
    authInputBg: "rgba(255,255,255,0.07)",
    authInputBorder: "rgba(255,255,255,0.22)",
    authMuted: "rgba(251,238,234,0.62)",
    authAction: "#e2b04a",
    authActionText: "#3a2200",
  },
};

const variant = (Constants.expoConfig?.extra?.appVariant as BrandConfig["key"] | undefined) ?? "workplix";

export const BRAND: BrandConfig = BRANDS[variant] ?? BRANDS.workplix;

/**
 * True when `orgSlug` belongs to an organization this app build shouldn't
 * grant access to — auth/backend are shared across brand variants, so a
 * valid Supabase session for e.g. a Seau de Crabe employee logging into the
 * plain Workplix app (or vice versa) would otherwise still work. A locked
 * variant (Seau de Crabe) only ever admits its own org; the unlocked variant
 * (Workplix) admits anything except orgs locked to a *different* variant.
 */
export function isWrongBrandOrg(orgSlug: string | null | undefined): boolean {
  if (!orgSlug) return false;
  if (BRAND.lockedOrgSlug) {
    return orgSlug !== BRAND.lockedOrgSlug;
  }
  return Object.values(BRANDS).some((b) => b.key !== BRAND.key && b.lockedOrgSlug === orgSlug);
}
