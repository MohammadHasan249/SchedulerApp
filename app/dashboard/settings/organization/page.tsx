import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ThemeEditor } from "@/components/settings/ThemeEditor";
import { OrganizationThemeClient } from "@/components/settings/OrganizationThemeClient";

export default async function OrganizationSettingsPage() {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Only organization admins can access this page.
        </p>
      </div>
    );
  }

  let theme = {
    primary: "#3b82f6",
    secondary: "#64748b",
    accent: "#06b6d4",
    background: "#ffffff",
    foreground: "#000000",
  };

  try {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (org?.theme) theme = org.theme as any;
  } catch {
    // DB migration pending — theme column doesn't exist yet
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize your organization&apos;s appearance and branding.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Brand Colors</h2>
          <OrganizationThemeClient initialTheme={theme} />
        </div>
      </div>
    </div>
  );
}
