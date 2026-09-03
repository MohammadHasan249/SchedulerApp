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
import { getZonedDayStart } from "@/lib/utils/timezone";

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

  const branchTimezoneRows = await db
    .select({ id: branches.id, timezone: branches.timezone })
    .from(branches)
    .where(inArray(branches.id, branchIds));
  const branchTimezones = Object.fromEntries(branchTimezoneRows.map((b) => [b.id, b.timezone]));

  // Each branch has its own local "today", so compute per-branch day boundaries
  // rather than a single server/UTC-relative window.
  const now = new Date();
  const branchDayBounds = Object.fromEntries(
    branchTimezoneRows.map((b) => {
      const start = getZonedDayStart(b.timezone, now);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      return [b.id, { start, end }];
    })
  );
  // Widest window across all branches, to bound the SQL query; exact filtering
  // per-branch happens in JS below.
  const queryWindowStart = new Date(
    Math.min(...Object.values(branchDayBounds).map((b) => b.start.getTime()))
  );
  const queryWindowEnd = new Date(
    Math.max(...Object.values(branchDayBounds).map((b) => b.end.getTime()))
  );

  const [allShiftRows, allClockEvents, pendingTimeOff] = await Promise.all([
    db
      .select({
        id: shifts.id,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        branchId: shifts.branchId,
        employeeName: employees.name,
      })
      .from(shifts)
      .leftJoin(shiftAssignments, eq(shiftAssignments.shiftId, shifts.id))
      .leftJoin(employees, eq(employees.id, shiftAssignments.employeeId))
      .where(
        and(
          inArray(shifts.branchId, branchIds),
          gte(shifts.startTime, queryWindowStart),
          lte(shifts.startTime, queryWindowEnd),
          eq(shifts.isPublished, true)
        )
      ),
    db
      .select({
        employeeId: clockEvents.employeeId,
        type: clockEvents.type,
        branchId: clockEvents.branchId,
        timestamp: clockEvents.timestamp,
      })
      .from(clockEvents)
      .where(
        and(
          inArray(clockEvents.branchId, branchIds),
          gte(clockEvents.timestamp, queryWindowStart)
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

  const todayShiftRows = allShiftRows.filter((r) => {
    const bounds = branchDayBounds[r.branchId];
    return (
      bounds && r.startTime >= bounds.start && r.startTime <= bounds.end
    );
  });
  const todayClockEvents = allClockEvents.filter((e) => {
    const bounds = branchDayBounds[e.branchId];
    return bounds && e.timestamp >= bounds.start;
  });

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
      timezone: branchTimezones[r.branchId] ?? "UTC",
    })),
  });
});
