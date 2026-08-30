export type BrandConfig = {
  key: "workplix" | "seaudecrabe";
  displayName: string;
  /** When set, org creation is disabled and employee signup is restricted to this org slug. */
  lockedOrgSlug: string | null;
};

const BRANDS: Record<BrandConfig["key"], BrandConfig> = {
  workplix: {
    key: "workplix",
    displayName: "Workplix",
    lockedOrgSlug: null,
  },
  seaudecrabe: {
    key: "seaudecrabe",
    displayName: "Seau de Crabe",
    lockedOrgSlug: "seau-de-crabe",
  },
};

const variant = (process.env.NEXT_PUBLIC_APP_VARIANT as BrandConfig["key"] | undefined) ?? "workplix";

export const BRAND: BrandConfig = BRANDS[variant] ?? BRANDS.workplix;
