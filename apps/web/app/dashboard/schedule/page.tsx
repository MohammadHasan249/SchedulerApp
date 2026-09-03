import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { shifts, shiftAssignments, employees, branches } from "@scheduler/database/schema";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { WeeklyScheduleGrid } from "@/components/schedule/WeeklyScheduleGrid";
import { getZonedWeekStart } from "@/lib/utils/timezone";
import {
  serializeShift,
  serializeAssignment,
  serializeEmployee,
  serializeBranch,
} from "@/lib/serialize";

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

  // Branches and employees are independent — fetch in parallel.
  const [branchRows, allEmployeeRows] = await Promise.all([
    db.select().from(branches).where(eq(branches.organizationId, user.organizationId)),
    db.select().from(employees).where(
      and(
        eq(employees.organizationId, user.organizationId),
        ...(user.role === "branch_manager" && user.branchId
          ? [eq(employees.branchId, user.branchId)]
          : [])
      )
    ),
  ]);

  const visibleBranchIds =
    user.role === "branch_manager" && user.branchId
      ? [user.branchId]
      : branchRows.map((b) => b.id);

  const primaryBranch =
    (user.role === "branch_manager" && user.branchId
      ? branchRows.find((b) => b.id === user.branchId)
      : branchRows[0]) ?? null;
  const timezone = primaryBranch?.timezone ?? "America/New_York";
  const weekStart = getZonedWeekStart(timezone, new Date(), 1);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

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

  const visibleShifts =
    user.role === "employee" ? shiftRows.filter((s) => s.isPublished) : shiftRows;

  const shiftIds = visibleShifts.map((s) => s.id);

  const [assignmentRows, employeeRows] = await Promise.all([
    shiftIds.length > 0
      ? db.select().from(shiftAssignments).where(inArray(shiftAssignments.shiftId, shiftIds))
      : Promise.resolve([]),
    Promise.resolve(allEmployeeRows),
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
        shifts={visibleShifts.map((s) => serializeShift(s))}
        assignments={assignmentRows.map(serializeAssignment)}
        employees={employeeRows.map(serializeEmployee)}
        branches={branchRows.map(serializeBranch)}
        availability={availabilityRows}
        canEdit={user.role !== "employee"}
        currentBranchId={currentBranchId}
        userRole={user.role}
      />
    </div>
  );
}
