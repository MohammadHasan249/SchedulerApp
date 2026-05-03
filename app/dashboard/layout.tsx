import { getUser } from "@/lib/auth/getUser";
import { OrgContextProvider } from "@/components/providers/OrgContext";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { db } from "@/lib/db";
import { employees, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const [[emp], [org]] = await Promise.all([
    db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1),
    db
      .select({ name: organizations.name, theme: organizations.theme, logoUrl: organizations.logoUrl })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1),
  ]);

  // apple-touch-icon: use org logo if uploaded, else generated icon in brand color
  const logoUrl = (org as any)?.logoUrl as string | undefined;
  const appleTouchIcon = logoUrl
    ? `/icon/180?logo=${encodeURIComponent(logoUrl)}`
    : `/icon/180?color=%233b82f6`;

  return (
    <OrgContextProvider user={user} organization={org as any}>
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
