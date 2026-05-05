import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { clockEvents, employees, branches } from "@scheduler/database/schema";
import { eq, and, desc, gte, inArray } from "drizzle-orm";
import { AttendanceLog } from "@/components/reports/AttendanceLog";
import { format, startOfDay } from "date-fns";

export default async function ReportsPage() {
  const user = await getUser();
  requireRole(user, "org_admin", "branch_manager");

  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const visibleBranchIds =
    user.role === "branch_manager" && user.branchId
      ? [user.branchId]
      : branchRows.map((b) => b.id);

  const todayStart = startOfDay(new Date());

  const initialRows =
    visibleBranchIds.length > 0
      ? await db
          .select({ event: clockEvents, employee: employees })
          .from(clockEvents)
          .innerJoin(employees, eq(clockEvents.employeeId, employees.id))
          .where(
            and(
              inArray(clockEvents.branchId, visibleBranchIds),
              gte(clockEvents.timestamp, todayStart)
            )
          )
          .orderBy(desc(clockEvents.timestamp))
      : [];

  const visibleBranches =
    user.role === "branch_manager" && user.branchId
      ? branchRows.filter((b) => b.id === user.branchId)
      : branchRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Clock-in/out records. Showing today by default.
        </p>
      </div>
      <AttendanceLog initialRows={initialRows} branches={visibleBranches} />
    </div>
  );
}
