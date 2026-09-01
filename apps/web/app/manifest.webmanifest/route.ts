import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import type { OrganizationTheme } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
import { getBrandForHost } from "@/lib/brand";

// Brands locked to a specific org (e.g. seaudecrabe.workplix.app) know their
// org's real slug directly — the subdomain itself isn't guaranteed to match
// it (compare "seaudecrabe.workplix.app" vs. org slug "seau-de-crabe").
// Everything else (plain multi-tenant subdomains like acme.workplix.app)
// falls back to reading the org slug off the subdomain.
function slugFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const lockedOrgSlug = getBrandForHost(hostname).lockedOrgSlug;
  if (lockedOrgSlug) return lockedOrgSlug;
  const parts = hostname.split(".");
  return parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app" ? parts[0] : null;
}

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const slug = slugFromHost(host);

  let name = "Workplix";
  let shortName = "Workplix";
  let primaryColor = "#3b82f6";
  let logoUrl: string | null = null;

  if (slug) {
    try {
      const [org] = await db
        .select({
          name: organizations.name,
          theme: organizations.theme,
          logoUrl: organizations.logoUrl,
        })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (org) {
        name = org.name;
        shortName = org.name.split(" ").slice(0, 2).join(" ");
        primaryColor = (org.theme as OrganizationTheme | null)?.primary ?? "#3b82f6";
        logoUrl = org.logoUrl ?? null;
      }
    } catch {
      // fall back to defaults
    }
  }

  // Use the org's uploaded logo if available. Orgs without one fall back to
  // the Workplix icon (or a generated one in their brand color if it's not
  // the default Workplix blue).
  const icons = logoUrl
    ? [{ src: logoUrl, sizes: "any", type: "image/png", purpose: "any maskable" }]
    : primaryColor === "#3b82f6"
      ? [
          { src: "/workplix-appicon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          {
            src: "/workplix-appicon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ]
      : [
          {
            src: `/icon/192?color=${encodeURIComponent(primaryColor)}`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `/icon/512?color=${encodeURIComponent(primaryColor)}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ];

  const manifest = {
    name,
    short_name: shortName,
    description: `${name} — staff scheduling`,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: primaryColor,
    icons,
    shortcuts: [
      {
        name: "Schedule",
        url: "/dashboard/schedule",
        description: "View weekly schedule",
      },
      {
        name: "Time Off",
        url: "/dashboard/time-off",
        description: "Request time off",
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
