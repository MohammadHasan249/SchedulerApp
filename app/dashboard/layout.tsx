import { getUser } from "@/lib/auth/getUser";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OrgContextProvider } from "@/components/providers/OrgContext";
import { db } from "@/lib/db";
import { employees } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  return (
    <OrgContextProvider user={user}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar role={user.role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={user} employeeId={emp?.id} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </OrgContextProvider>
  );
}
