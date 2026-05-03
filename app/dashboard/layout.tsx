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
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1),
  ]);

  return (
    <OrgContextProvider user={user} organization={org}>
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
