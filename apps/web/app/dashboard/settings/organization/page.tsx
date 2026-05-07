import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { organizations, organizationHours } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
import { ThemeEditor } from "@/components/settings/ThemeEditor";
import { OrganizationThemeClient } from "@/components/settings/OrganizationThemeClient";
import { OrgHoursClient } from "@/components/settings/OrgHoursClient";

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

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  const theme = (org?.theme as any) ?? {
    primary: "#3b82f6",
    secondary: "#64748b",
    accent: "#06b6d4",
    background: "#ffffff",
    foreground: "#000000",
  };

  const hours = await db
    .select()
    .from(organizationHours)
    .where(eq(organizationHours.organizationId, user.organizationId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize your organization's appearance and branding.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Brand Colors</h2>
          <OrganizationThemeClient initialTheme={theme} />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-1">Hours of Operation</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Set your organization's open hours per day. Use "Apply to All Employees" to push these as default availability.
          </p>
          <OrgHoursClient initialHours={hours} />
        </div>
      </div>
    </div>
  );
}
