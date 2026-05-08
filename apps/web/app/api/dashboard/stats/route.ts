import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clockEvents,
  shifts,
  shiftAssignments,
  timeOffRequests,
  employees,
  branches,
} from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export const GET = withAuth(async function GET() {
  const user = await getUser();
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchIds =
    user.role === "branch_manager"
      ? user.branchId
        ? [user.branchId]
        : []
      : (
          await db
            .select({ id: branches.id })
            .from(branches)
            .where(eq(branches.organizationId, user.organizationId))
        ).map((b) => b.id);

  if (branchIds.length === 0) {
    return NextResponse.json({
      clockedInCount: 0,
      totalShiftsToday: 0,
      pendingTimeOffCount: 0,
      todayShifts: [],
    });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const orgEmployeeIds = (
    await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.organizationId, user.organizationId),
          eq(employees.isActive, true)
        )
      )
  ).map((e) => e.id);

  const [todayShiftRows, todayClockEvents, pendingTimeOff] = await Promise.all([
    db
      .select({
        id: shifts.id,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        employeeName: employees.name,
      })
      .from(shifts)
      .leftJoin(shiftAssignments, eq(shiftAssignments.shiftId, shifts.id))
      .leftJoin(employees, eq(employees.id, shiftAssignments.employeeId))
      .where(
        and(
          inArray(shifts.branchId, branchIds),
          gte(shifts.startTime, dayStart),
          lte(shifts.startTime, dayEnd),
          eq(shifts.isPublished, true)
        )
      ),
    db
      .select({ employeeId: clockEvents.employeeId, type: clockEvents.type })
      .from(clockEvents)
      .where(
        and(
          inArray(clockEvents.branchId, branchIds),
          gte(clockEvents.timestamp, dayStart)
        )
      )
      .orderBy(clockEvents.timestamp),
    orgEmployeeIds.length > 0
      ? db
          .select({ id: timeOffRequests.id })
          .from(timeOffRequests)
          .where(
            and(
              inArray(timeOffRequests.employeeId, orgEmployeeIds),
              eq(timeOffRequests.status, "pending")
            )
          )
      : Promise.resolve([]),
  ]);

  const latestByEmployee = new Map<string, "clock_in" | "clock_out">();
  for (const e of todayClockEvents) {
    latestByEmployee.set(e.employeeId, e.type);
  }
  const clockedInCount = [...latestByEmployee.values()].filter(
    (t) => t === "clock_in"
  ).length;

  const uniqueShiftIds = new Set(todayShiftRows.map((r) => r.id));

  return NextResponse.json({
    clockedInCount,
    totalShiftsToday: uniqueShiftIds.size,
    pendingTimeOffCount: pendingTimeOff.length,
    todayShifts: todayShiftRows.map((r) => ({
      id: r.id,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      employeeName: r.employeeName ?? null,
    })),
  });
});
