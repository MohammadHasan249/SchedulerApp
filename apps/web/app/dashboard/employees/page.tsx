import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { employees, branches, jobRoles } from "@scheduler/database/schema";
import { eq, and } from "drizzle-orm";
import { EmployeeTable } from "@/components/employees/EmployeeTable";

export default async function EmployeesPage() {
  const user = await getUser();
  requireRole(user, "org_admin", "branch_manager");

  const conditions = [eq(employees.organizationId, user.organizationId)];
  if (user.role === "branch_manager" && user.branchId) {
    conditions.push(eq(employees.branchId, user.branchId));
  }

  const [employeeRows, branchRows, roleRows] = await Promise.all([
    db.select().from(employees).where(and(...conditions)),
    db.select().from(branches).where(eq(branches.organizationId, user.organizationId)),
    db.select().from(jobRoles).where(eq(jobRoles.organizationId, user.organizationId)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your team members.</p>
      </div>
      <EmployeeTable
        employees={employeeRows}
        branches={branchRows}
        jobRoles={roleRows}
        currentUserRole={user.role}
        currentUserBranchId={user.branchId}
      />
    </div>
  );
}
