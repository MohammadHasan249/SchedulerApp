import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { shifts, shiftAssignments, employees, branches, availability } from "@/db/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { startOfWeek, addDays } from "date-fns";
import { WeeklyScheduleGrid } from "@/components/schedule/WeeklyScheduleGrid";

export default async function SchedulePage() {
  const user = await getUser();

  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const visibleBranchIds =
    user.role === "branch_manager" && user.branchId
      ? [user.branchId]
      : branchRows.map((b) => b.id);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const shiftRows =
    visibleBranchIds.length > 0
      ? await db
          .select()
          .from(shifts)
          .where(
            and(
              inArray(shifts.branchId, visibleBranchIds),
              gte(shifts.startTime, weekStart),
              lte(shifts.startTime, weekEnd)
            )
          )
      : [];

  // Employees only see published
  const visibleShifts =
    user.role === "employee" ? shiftRows.filter((s) => s.isPublished) : shiftRows;

  const shiftIds = visibleShifts.map((s) => s.id);

  const [assignmentRows, employeeRows] = await Promise.all([
    shiftIds.length > 0
      ? db.select().from(shiftAssignments).where(inArray(shiftAssignments.shiftId, shiftIds))
      : Promise.resolve([]),
    db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, user.organizationId),
          ...(user.role === "branch_manager" && user.branchId
            ? [eq(employees.branchId, user.branchId)]
            : [])
        )
      ),
  ]);

  const employeeIds = employeeRows.map((e) => e.id);
  const availabilityRows =
    employeeIds.length > 0
      ? await db
          .select()
          .from(availability)
          .where(inArray(availability.employeeId, employeeIds))
      : [];

  const currentBranchId = user.branchId ?? branchRows[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">Weekly shift schedule.</p>
      </div>
      <WeeklyScheduleGrid
        shifts={visibleShifts}
        assignments={assignmentRows}
        employees={employeeRows}
        branches={branchRows}
        availability={availabilityRows}
        canEdit={user.role !== "employee"}
        currentBranchId={currentBranchId}
        userRole={user.role}
      />
    </div>
  );
}
