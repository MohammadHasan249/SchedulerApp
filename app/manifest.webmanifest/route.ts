import { db } from "@/lib/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

function slugFromHost(host: string): string | null {
  const parts = host.split(".");
  return parts.length >= 3 && parts[0] !== "www" && parts[0] !== "app" ? parts[0] : null;
}

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const slug = slugFromHost(host);

  let name = "Scheduler App";
  let shortName = "Scheduler";
  let primaryColor = "#3b82f6";
  let logoUrl: string | null = null;

  if (slug) {
    try {
      const [org] = await db
        .select({
          name: organizations.name,
          primaryColor: organizations.primaryColor,
          logoUrl: organizations.logoUrl,
        })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (org) {
        name = org.name;
        shortName = org.name.split(" ").slice(0, 2).join(" ");
        primaryColor = org.primaryColor ?? "#3b82f6";
        logoUrl = org.logoUrl ?? null;
      }
    } catch {
      // fall back to defaults
    }
  }

  // Use the org's uploaded logo if available, otherwise fall back to the
  // generated calendar icon in their brand color.
  const icons = logoUrl
    ? [{ src: logoUrl, sizes: "any", type: "image/png", purpose: "any maskable" }]
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
