import { getUser } from "@/lib/auth/getUser";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OrgContextProvider } from "@/components/providers/OrgContext";
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
    <OrgContextProvider user={user}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar role={user.role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={user} employeeId={emp?.id} employeeName={emp?.name} orgName={org?.name} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </OrgContextProvider>
  );
}
