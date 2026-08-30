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
};

const BRANDS: Record<BrandConfig["key"], BrandConfig> = {
  workplix: {
    key: "workplix",
    displayName: "Workplix",
    lockedOrgSlug: null,
    lockedThemeKey: null,
    authBackground: "#0f172a",
  },
  seaudecrabe: {
    key: "seaudecrabe",
    displayName: "Seau de Crabe",
    lockedOrgSlug: "seau-de-crabe",
    lockedThemeKey: "crimson",
    authBackground: "#450a0a",
  },
};

const variant = (Constants.expoConfig?.extra?.appVariant as BrandConfig["key"] | undefined) ?? "workplix";

export const BRAND: BrandConfig = BRANDS[variant] ?? BRANDS.workplix;
