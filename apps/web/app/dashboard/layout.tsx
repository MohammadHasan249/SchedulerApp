import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { OrgContextProvider } from "@/components/providers/OrgContext";
import { ThemeInjector } from "@/components/providers/ThemeInjector";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { db } from "@/lib/db";
import { employees, organizations } from "@scheduler/database/schema";
import { eq, and } from "drizzle-orm";
import { BRAND } from "@/lib/brand";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const [[emp], [org]] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1),
    db
      .select({
        name: organizations.name,
        slug: organizations.slug,
        theme: organizations.theme,
        logoUrl: organizations.logoUrl,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1),
  ]);

  // Authoritative org-id/slug gate for locked-brand deployments (e.g. Seau de
  // Crabe): even a valid session from another brand's org must not reach the
  // dashboard here, since auth/backend are shared across brands.
  if (BRAND.lockedOrgSlug && org?.slug !== BRAND.lockedOrgSlug) {
    redirect("/api/auth/logout?reason=wrong-brand");
  }

  // apple-touch-icon: use org logo if uploaded, else generated icon in brand color
  const logoUrl = (org as any)?.logoUrl as string | undefined;
  const appleTouchIcon = logoUrl
    ? `/icon/180?logo=${encodeURIComponent(logoUrl)}`
    : `/icon/180?color=%233b82f6`;

  return (
    <OrgContextProvider user={user} organization={org as any}>
      <ThemeInjector />
      {/* Next.js hoists bare <link> tags to <head> automatically */}
      <link rel="apple-touch-icon" href={appleTouchIcon} />
      <DashboardShell
        user={user}
        employeeId={emp?.id}
        employeeName={emp?.name}
        orgName={org?.name}
      >
        {children}
      </DashboardShell>
    </OrgContextProvider>
  );
}
