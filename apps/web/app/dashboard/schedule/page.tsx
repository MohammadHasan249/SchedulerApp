import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { shifts, shiftAssignments, employees, branches } from "@scheduler/database/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { startOfWeek, addDays } from "date-fns";
import { WeeklyScheduleGrid } from "@/components/schedule/WeeklyScheduleGrid";

type AvailabilityRow = { dayOfWeek: number; startTime: string; endTime: string };

function scheduleToRows(schedule: Record<number, { startTime: string; endTime: string }> | null): AvailabilityRow[] {
  if (!schedule) return [];
  return Object.entries(schedule).map(([day, slot]) => ({
    dayOfWeek: parseInt(day, 10),
    startTime: slot.startTime,
    endTime: slot.endTime,
  }));
}

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

  // Convert availabilitySchedule from all employees to a flat array for backward compatibility
  const availabilityRows: AvailabilityRow[] = [];
  employeeRows.forEach((emp) => {
    const schedule = emp.availabilitySchedule as Record<number, { startTime: string; endTime: string }> | null;
    const rows = scheduleToRows(schedule);
    availabilityRows.push(...rows);
  });

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
