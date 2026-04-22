import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { timeOffRequests, employees } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { TimeOffRequestTable } from "@/components/time-off/TimeOffRequestTable";

export default async function TimeOffPage() {
  const user = await getUser();

  const canApprove = user.role !== "employee";

  let requests: typeof timeOffRequests.$inferSelect[] = [];
  let employeeRows: typeof employees.$inferSelect[] = [];

  if (user.role === "employee") {
    const [emp] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1);

    if (emp) {
      requests = await db
        .select()
        .from(timeOffRequests)
        .where(eq(timeOffRequests.employeeId, emp.id));
    }
  } else {
    const empConditions = [eq(employees.organizationId, user.organizationId)];
    if (user.role === "branch_manager" && user.branchId) {
      empConditions.push(eq(employees.branchId, user.branchId));
    }

    employeeRows = await db.select().from(employees).where(and(...empConditions));
    const empIds = employeeRows.map((e) => e.id);

    if (empIds.length > 0) {
      requests = await db
        .select()
        .from(timeOffRequests)
        .where(inArray(timeOffRequests.employeeId, empIds));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Time Off</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {canApprove ? "Review and manage time-off requests." : "Submit and track your time-off requests."}
        </p>
      </div>
      <TimeOffRequestTable
        requests={requests}
        canApprove={canApprove}
        employees={employeeRows}
      />
    </div>
  );
}
