import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { departments, jobRoles, branches } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { DepartmentList } from "@/components/departments/DepartmentList";

export default async function DepartmentsPage() {
  const user = await getUser();

  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const visibleBranchIds =
    user.role === "branch_manager" && user.branchId
      ? [user.branchId]
      : branchRows.map((b) => b.id);

  const deptRows =
    visibleBranchIds.length > 0
      ? await db.select().from(departments).where(inArray(departments.branchId, visibleBranchIds))
      : [];

  const deptIds = deptRows.map((d) => d.id);
  const roleRows =
    deptIds.length > 0
      ? await db.select().from(jobRoles).where(inArray(jobRoles.departmentId, deptIds))
      : [];

  const deptsWithRoles = deptRows.map((d) => ({
    ...d,
    jobRoles: roleRows.filter((r) => r.departmentId === d.id),
  }));

  const visibleBranches =
    user.role === "branch_manager" && user.branchId
      ? branchRows.filter((b) => b.id === user.branchId)
      : branchRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage departments and their job roles.
        </p>
      </div>
      <DepartmentList
        departments={deptsWithRoles}
        branches={visibleBranches}
        currentUserRole={user.role}
        currentUserBranchId={user.branchId}
      />
    </div>
  );
}
