export type BrandKey = "workplix" | "seaudecrabe";

export type BrandConfig = {
  key: BrandKey;
  displayName: string;
  /** Domain this brand is served on (used to resolve brand from a request's Host header). */
  hostname: string | null;
  /** When set, org creation is disabled and employee signup is restricted to this org slug. */
  lockedOrgSlug: string | null;
  /** Base URL used for links in emails and auth redirects for this brand. */
  appUrl: string;
  /**
   * When set, the dashboard's brand-color theme is fixed to this value
   * (buttons, links, focus rings) and the "Brand Colors" picker in Settings
   * is hidden — mirrors the mobile app's `lockedThemeKey`, which ignores
   * `organizations.theme` entirely for locked-brand variants so the two
   * clients can't visually diverge.
   */
  lockedThemePrimary: string | null;
  /**
   * When set, the sidebar's background is fixed to this value instead of
   * `lockedThemePrimary` — mirrors mobile's dark crimson chrome
   * (apps/mobile/lib/useAppTheme.ts DARK_CRIMSON.bg), which is a distinct
   * color from the brass accent used on buttons/active states.
   */
  lockedSidebarBg: string | null;
};

export const BRANDS: Record<BrandKey, BrandConfig> = {
  workplix: {
    key: "workplix",
    displayName: "Workplix",
    hostname: null,
    lockedOrgSlug: null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    lockedThemePrimary: null,
    lockedSidebarBg: null,
  },
  seaudecrabe: {
    key: "seaudecrabe",
    displayName: "Seau de Crabe",
    hostname: "seaudecrabe.workplix.app",
    lockedOrgSlug: "seau-de-crabe",
    appUrl: "https://seaudecrabe.workplix.app",
    // Antique brass — matches apps/mobile/lib/brand.ts BRANDS.seaudecrabe.authAction.
    lockedThemePrimary: "#c99a45",
    // Deep wine-red — matches apps/mobile/lib/useAppTheme.ts DARK_CRIMSON.bg.
    lockedSidebarBg: "#57101a",
  },
};

/** Query param value the dashboard's brand-mismatch redirect passes to /login. */
export const WRONG_BRAND_REASON = "wrong-brand";

/**
 * Brand for a given request, based on which domain it came in on. Use this
 * for page rendering and for web-only gating (org creation, dashboard
 * access) — anything scoped to "which site is the browser on."
 */
export function getBrandForHost(host: string | null | undefined): BrandConfig {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const entry = Object.values(BRANDS).find((b) => b.hostname === hostname);
  return entry ?? BRANDS.workplix;
}

/**
 * True when `orgSlug` belongs to an organization that shouldn't be reachable
 * on `hostBrand`'s domain — a locked-brand domain (e.g.
 * seaudecrabe.workplix.app) only admits its own org, and the unlocked domain
 * (workplix.app) in turn excludes orgs locked to a *different* brand, so a
 * Seau de Crabe admin with a valid session can't fall through to the plain
 * Workplix dashboard just because that host has no lock of its own. Mirrors
 * apps/mobile/lib/brand.ts isWrongBrandOrg and isWrongBrandOrgForVariant
 * above, but keyed off the resolved host brand rather than a variant string.
 */
export function isWrongBrandOrgForHost(
  hostBrand: BrandConfig,
  orgSlug: string | null | undefined
): boolean {
  if (!orgSlug) return false;
  if (hostBrand.lockedOrgSlug) {
    return orgSlug !== hostBrand.lockedOrgSlug;
  }
  return Object.values(BRANDS).some((b) => b.key !== hostBrand.key && b.lockedOrgSlug === orgSlug);
}

/**
 * True when `orgSlug` belongs to an organization the given mobile app
 * variant shouldn't grant access to — mirrors
 * apps/mobile/lib/brand.ts isWrongBrandOrg, but takes the variant as a
 * parameter (rather than reading it off `Constants`) since this runs
 * server-side for a client we don't have a build-time brand for. Used by
 * the mobile login route to reject a brand mismatch before a session is
 * ever issued to the device, instead of relying on the client to notice
 * and sign itself back out.
 */
export function isWrongBrandOrgForVariant(
  variant: BrandKey | null | undefined,
  orgSlug: string | null | undefined
): boolean {
  if (!orgSlug || !variant) return false;
  const brand = BRANDS[variant];
  if (!brand) return false;
  if (brand.lockedOrgSlug) {
    return orgSlug !== brand.lockedOrgSlug;
  }
  return Object.values(BRANDS).some((b) => b.key !== brand.key && b.lockedOrgSlug === orgSlug);
}

/**
 * Brand for a given organization, based on its slug. Use this for anything
 * where the recipient's brand identity matters regardless of which client
 * (web domain or mobile app) made the request — e.g. transactional email
 * copy and links, since mobile always calls the same shared API host
 * regardless of which brand variant the app is.
 */
export function getBrandForOrgSlug(orgSlug: string | null | undefined): BrandConfig {
  const entry = Object.values(BRANDS).find((b) => b.lockedOrgSlug === orgSlug);
  return entry ?? BRANDS.workplix;
}
