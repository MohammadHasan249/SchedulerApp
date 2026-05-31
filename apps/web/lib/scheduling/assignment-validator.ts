import { db } from "@/lib/db";
import {
  employees,
  shifts,
  shiftAssignments,
  timeOffRequests,
} from "@scheduler/database/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";

export type AssignmentValidationError =
  | "EMPLOYEE_INACTIVE"
  | "DUPLICATE_ASSIGNMENT"
  | "OUTSIDE_AVAILABILITY"
  | "TIME_OFF_CONFLICT"
  | "EXCEEDS_MAX_HOURS"
  | "OVERLAPPING_SHIFT"
  | "PAST_SHIFT";

export type AssignmentValidationResult =
  | { ok: true }
  | { ok: false; code: AssignmentValidationError; message: string };

type Shift = typeof shifts.$inferSelect;
type Employee = typeof employees.$inferSelect;

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export async function validateAssignment(
  shift: Shift,
  employee: Employee
): Promise<AssignmentValidationResult> {
  if (!employee.isActive) {
    return { ok: false, code: "EMPLOYEE_INACTIVE", message: "Employee is deactivated." };
  }

  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);

  if (shiftStart < new Date()) {
    return { ok: false, code: "PAST_SHIFT", message: "Cannot assign past shifts." };
  }

  // Duplicate assignment check
  const [existing] = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.shiftId, shift.id),
        eq(shiftAssignments.employeeId, employee.id)
      )
    )
    .limit(1);

  if (existing) {
    return {
      ok: false,
      code: "DUPLICATE_ASSIGNMENT",
      message: "Employee is already assigned to this shift.",
    };
  }

  // Availability check
  const schedule = employee.availabilitySchedule as
    | Record<string, { startTime: string; endTime: string }>
    | null;
  const dayOfWeek = shiftStart.getDay();
  const slot = schedule?.[String(dayOfWeek)];

  if (slot) {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const startMin = shiftStart.getHours() * 60 + shiftStart.getMinutes();
    const endMin = shiftEnd.getHours() * 60 + shiftEnd.getMinutes();
    if (startMin < toMin(slot.startTime) || endMin > toMin(slot.endTime)) {
      return {
        ok: false,
        code: "OUTSIDE_AVAILABILITY",
        message: `Employee is only available ${slot.startTime}–${slot.endTime} on that day.`,
      };
    }
  }

  // Approved time off
  const shiftDate = shiftStart.toISOString().split("T")[0];
  const [timeOff] = await db
    .select({ id: timeOffRequests.id })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.employeeId, employee.id),
        eq(timeOffRequests.status, "approved"),
        lte(timeOffRequests.startDate, shiftDate),
        gte(timeOffRequests.endDate, shiftDate)
      )
    )
    .limit(1);
  if (timeOff) {
    return {
      ok: false,
      code: "TIME_OFF_CONFLICT",
      message: "Employee has approved time off on that day.",
    };
  }

  // Overlapping shift assignment
  const overlapping = await db
    .select({ id: shifts.id })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
    .where(
      and(
        eq(shiftAssignments.employeeId, employee.id),
        ne(shifts.id, shift.id),
        lte(shifts.startTime, shiftEnd),
        gte(shifts.endTime, shiftStart)
      )
    )
    .limit(1);
  if (overlapping.length > 0) {
    return {
      ok: false,
      code: "OVERLAPPING_SHIFT",
      message: "Employee is already assigned to an overlapping shift.",
    };
  }

  // Weekly hours cap
  const weekStart = new Date(shiftStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const weekAssignments = await db
    .select({ startTime: shifts.startTime, endTime: shifts.endTime })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
    .where(
      and(
        eq(shiftAssignments.employeeId, employee.id),
        gte(shifts.startTime, weekStart),
        lte(shifts.startTime, weekEnd)
      )
    );

  const currentHours = weekAssignments.reduce(
    (sum, a) => sum + hoursBetween(new Date(a.startTime), new Date(a.endTime)),
    0
  );
  const shiftHours = hoursBetween(shiftStart, shiftEnd);
  const maxHours = employee.maxHoursPerWeek ?? 40;

  if (currentHours + shiftHours > maxHours) {
    return {
      ok: false,
      code: "EXCEEDS_MAX_HOURS",
      message: `Would bring employee to ${Math.round((currentHours + shiftHours) * 10) / 10}h this week (max ${maxHours}h).`,
    };
  }

  return { ok: true };
}
