import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  shiftRoleRequirements,
  employees,
  timeOffRequests,
  branches,
} from "@scheduler/database/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { coversAvailability, type AvailabilitySchedule } from "./availability";
import { getZonedParts } from "@/lib/utils/timezone";

export interface AutoAssignResult {
  shiftId: string;
  employeeId: string;
  jobRoleId: string | null;
}

interface EmployeeCandidate {
  employeeId: string;
  jobRoleId: string | null;
  hoursAssigned: number;
  jobRoleMatch: boolean;
}

export async function autoAssignShifts(
  organizationId: string,
  branchId: string,
  fromDate: Date,
  toDate: Date
): Promise<AutoAssignResult[]> {
  const assignments: AutoAssignResult[] = [];

  // Get all unpublished shifts in the date range for this branch.
  // (We further filter below to exclude shifts that already meet their headcount.)
  const candidateShifts = await db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.branchId, branchId),
        gte(shifts.startTime, fromDate),
        lte(shifts.endTime, toDate),
        eq(shifts.isPublished, false)
      )
    );

  if (candidateShifts.length === 0) {
    return [];
  }

  // Availability is evaluated in the branch's timezone, not the server's.
  const [branchRow] = await db
    .select({ timezone: branches.timezone })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  const timezone = branchRow?.timezone ?? "UTC";

  // Existing assignments on these shifts (to avoid stacking on top of prior runs).
  const candidateShiftIds = candidateShifts.map((s) => s.id);
  const existingByShift = new Map<string, { employeeId: string; jobRoleId: string | null }[]>();
  if (candidateShiftIds.length > 0) {
    const rows = await db
      .select({
        shiftId: shiftAssignments.shiftId,
        employeeId: shiftAssignments.employeeId,
        jobRoleId: shiftAssignments.jobRoleId,
      })
      .from(shiftAssignments)
      .where(inArray(shiftAssignments.shiftId, candidateShiftIds));
    for (const r of rows) {
      if (!existingByShift.has(r.shiftId)) existingByShift.set(r.shiftId, []);
      existingByShift.get(r.shiftId)!.push({ employeeId: r.employeeId, jobRoleId: r.jobRoleId });
    }
  }

  // unassignedShifts: shifts that still need bodies (no assignments, or under headcount per role).
  const unassignedShifts = candidateShifts;

  // Get all active employees in this organization
  const allEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), eq(employees.isActive, true)));

  const employeeIds = allEmployees.map((e) => e.id);

  // Build availability map from employees' availabilitySchedule JSON. Stored raw
  // (keyed by day-of-week) so coversAvailability can evaluate it in branch time.
  const availabilityByEmployeeId = new Map<string, AvailabilitySchedule>();
  allEmployees.forEach((emp) => {
    const schedule = emp.availabilitySchedule as AvailabilitySchedule;
    if (schedule) availabilityByEmployeeId.set(emp.id, schedule);
  });

  // Batch fetch approved time-off requests scoped to this org's employees only
  const approvedTimeOff =
    employeeIds.length > 0
      ? await db
          .select()
          .from(timeOffRequests)
          .where(
            and(
              eq(timeOffRequests.status, "approved"),
              inArray(timeOffRequests.employeeId, employeeIds)
            )
          )
      : [];

  const timeOffByEmployeeId = buildTimeOffMap(approvedTimeOff, fromDate, toDate);

  // Batch fetch existing shift assignments to calculate hours (exclude unpublished shifts).
  // Scope to the planning window [fromDate, toDate] — maxHoursPerWeek is a *weekly*
  // cap, so counting all-time published hours would (for any established branch)
  // push every employee past their max and silently assign nobody. Counting only
  // hours inside the same window the new shifts fall into keeps the cap meaningful.
  const existingAssignments = await db
    .select({
      employeeId: shiftAssignments.employeeId,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
    })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
    .where(
      and(
        eq(shifts.branchId, branchId),
        eq(shifts.isPublished, true), // Only count published shifts
        gte(shifts.startTime, fromDate),
        lte(shifts.endTime, toDate)
      )
    );

  const hoursPerEmployee = new Map<string, number>();
  existingAssignments.forEach(({ employeeId, startTime, endTime }) => {
    const hours =
      (new Date(endTime).getTime() - new Date(startTime).getTime()) /
      (1000 * 60 * 60);
    hoursPerEmployee.set(
      employeeId,
      (hoursPerEmployee.get(employeeId) || 0) + hours
    );
  });

  // Batch fetch all role requirements for all shifts (avoid N+1)
  const shiftIds = unassignedShifts.map((s) => s.id);
  const allRoleRequirements =
    shiftIds.length > 0
      ? await db
          .select()
          .from(shiftRoleRequirements)
          .where(inArray(shiftRoleRequirements.shiftId, shiftIds))
      : [];

  const roleRequirementsByShiftId = new Map<
    string,
    (typeof shiftRoleRequirements.$inferSelect)[]
  >();
  allRoleRequirements.forEach((req) => {
    if (!roleRequirementsByShiftId.has(req.shiftId)) {
      roleRequirementsByShiftId.set(req.shiftId, []);
    }
    roleRequirementsByShiftId.get(req.shiftId)!.push(req);
  });

  // For each shift, try to assign employees.
  // We use a per-shift "already assigned" set seeded with existing assignments
  // so re-running auto-assign on the same shift doesn't add the same employee twice
  // or stack assignments past the headcount requirement.
  for (const shift of unassignedShifts) {
    const existing = existingByShift.get(shift.id) ?? [];
    const shiftAssignedSet = new Set<string>(existing.map((a) => a.employeeId));
    const roleRequirements = roleRequirementsByShiftId.get(shift.id) || [];

    if (roleRequirements.length === 0) {
      // No role requirements: assign one employee if shift has zero current assignments.
      if (existing.length > 0) continue;

      const candidate = findBestCandidate(
        shift,
        allEmployees,
        null,
        hoursPerEmployee,
        timeOffByEmployeeId,
        availabilityByEmployeeId,
        shiftAssignedSet,
        timezone
      );

      if (candidate) {
        const newAssignment: AutoAssignResult = {
          shiftId: shift.id,
          employeeId: candidate.employeeId,
          jobRoleId: null,
        };
        assignments.push(newAssignment);
        shiftAssignedSet.add(candidate.employeeId);

        const shiftHours = getShiftHours(shift);
        hoursPerEmployee.set(
          candidate.employeeId,
          (hoursPerEmployee.get(candidate.employeeId) || 0) + shiftHours
        );
      }
    } else {
      // Per-role requirement: only fill the remaining gap, never overshoot headcount.
      for (const req of roleRequirements) {
        const existingForRole = existing.filter((a) => a.jobRoleId === req.jobRoleId).length;
        const remaining = Math.max(0, req.headcount - existingForRole);
        for (let i = 0; i < remaining; i++) {
          const candidate = findBestCandidate(
            shift,
            allEmployees,
            req.jobRoleId,
            hoursPerEmployee,
            timeOffByEmployeeId,
            availabilityByEmployeeId,
            shiftAssignedSet,
            timezone
          );

          if (candidate) {
            const newAssignment: AutoAssignResult = {
              shiftId: shift.id,
              employeeId: candidate.employeeId,
              jobRoleId: req.jobRoleId,
            };
            assignments.push(newAssignment);
            shiftAssignedSet.add(candidate.employeeId);

            const shiftHours = getShiftHours(shift);
            hoursPerEmployee.set(
              candidate.employeeId,
              (hoursPerEmployee.get(candidate.employeeId) || 0) + shiftHours
            );
          }
        }
      }
    }
  }

  // Batch insert all assignments at once (atomic operation)
  if (assignments.length > 0) {
    try {
      await db.insert(shiftAssignments).values(assignments);
    } catch (error) {
      logger.error("Failed to insert shift assignments:", error);
      throw new Error("Failed to persist shift assignments to database");
    }
  }

  return assignments;
}

export interface TimeOffInterval {
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD" (inclusive)
}

export function buildTimeOffMap(
  requests: Pick<
    typeof timeOffRequests.$inferSelect,
    "employeeId" | "startDate" | "endDate"
  >[],
  fromDate: Date,
  toDate: Date
): Map<string, TimeOffInterval[]> {
  const map = new Map<string, TimeOffInterval[]>();

  // Prefilter to the planning window, widened by a day on each side: the
  // window bounds are normalized in UTC but shift dates are resolved in the
  // branch's timezone (at most ±14h from UTC), so a request touching the
  // window only in local time must not be dropped here.
  const DAY_MS = 86_400_000;
  const windowStart = new Date(fromDate.getTime() - DAY_MS)
    .toISOString()
    .slice(0, 10);
  const windowEnd = new Date(toDate.getTime() + DAY_MS)
    .toISOString()
    .slice(0, 10);

  for (const req of requests) {
    const start = String(req.startDate);
    const end = String(req.endDate);
    if (end < windowStart || start > windowEnd) continue;

    if (!map.has(req.employeeId)) map.set(req.employeeId, []);
    map.get(req.employeeId)!.push({ start, end });
  }

  return map;
}

export function isOnTimeOff(
  intervals: TimeOffInterval[] | undefined,
  dateStr: string
): boolean {
  return !!intervals?.some((iv) => iv.start <= dateStr && dateStr <= iv.end);
}

function getShiftHours(shift: typeof shifts.$inferSelect): number {
  return (
    (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) /
    (1000 * 60 * 60)
  );
}

function findBestCandidate(
  shift: typeof shifts.$inferSelect,
  allEmployees: (typeof employees.$inferSelect)[],
  requiredJobRoleId: string | null,
  hoursPerEmployee: Map<string, number>,
  timeOffByEmployeeId: Map<string, TimeOffInterval[]>,
  availabilityByEmployeeId: Map<string, AvailabilitySchedule>,
  assignedEmployeeSet: Set<string>,
  timezone: string
): EmployeeCandidate | null {
  const shiftHours = getShiftHours(shift);
  // Branch-local calendar date, matching how validateAssignment resolves
  // time-off (a 11pm local shift must not read as the next UTC day).
  const shiftDate = getZonedParts(new Date(shift.startTime), timezone).dateStr;

  const candidates: EmployeeCandidate[] = [];

  for (const emp of allEmployees) {
    // Skip if already assigned to this shift
    if (assignedEmployeeSet.has(emp.id)) {
      continue;
    }

    // Skip if employee has time-off on this day
    if (isOnTimeOff(timeOffByEmployeeId.get(emp.id), shiftDate)) {
      continue;
    }

    // Skip if assigning would exceed max hours
    const currentHours = hoursPerEmployee.get(emp.id) || 0;
    if (currentHours + shiftHours > (emp.maxHoursPerWeek || 40)) {
      continue;
    }

    // Check availability for this day/time (in the branch's timezone)
    const empAvailability = availabilityByEmployeeId.get(emp.id);
    if (
      !coversAvailability(
        empAvailability,
        new Date(shift.startTime),
        new Date(shift.endTime),
        timezone
      )
    ) {
      continue;
    }

    // Check job role match
    const jobRoleMatch =
      requiredJobRoleId === null || emp.jobRoleId === requiredJobRoleId;

    candidates.push({
      employeeId: emp.id,
      jobRoleId: emp.jobRoleId,
      hoursAssigned: currentHours,
      jobRoleMatch,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by: job role match (descending) -> fewest hours (ascending)
  candidates.sort((a, b) => {
    if (a.jobRoleMatch !== b.jobRoleMatch) {
      return a.jobRoleMatch ? -1 : 1;
    }
    return a.hoursAssigned - b.hoursAssigned;
  });

  return candidates[0];
}
