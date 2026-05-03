import { getUser } from "@/lib/auth/getUser";
import { OrgContextProvider } from "@/components/providers/OrgContext";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { db } from "@/lib/db";
import { employees, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const [emp] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  // Try fetching with theme; fall back to name-only if DB migration is still pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let org: { name: string; theme?: any } | undefined;
  try {
    const [row] = await db
      .select({ name: organizations.name, theme: organizations.theme })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    org = row;
  } catch {
    const [row] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);
    org = row;
  }

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <OrgContextProvider user={user} organization={org as any}>
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
