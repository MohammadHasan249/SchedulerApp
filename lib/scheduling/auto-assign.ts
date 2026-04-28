import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  shiftRoleRequirements,
  employees,
  availability,
  timeOffRequests,
} from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

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

interface EmployeeWithAvailability {
  id: string;
  maxHoursPerWeek: number | null;
  jobRoleId: string | null;
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

export async function autoAssignShifts(
  organizationId: string,
  branchId: string,
  fromDate: Date,
  toDate: Date
): Promise<AutoAssignResult[]> {
  const assignments: AutoAssignResult[] = [];

  // Get all unassigned shifts in the date range for this branch
  const unassignedShifts = await db
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

  if (unassignedShifts.length === 0) {
    return [];
  }

  // Get all employees in this organization
  const allEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.organizationId, organizationId));

  // Batch fetch all availability for all employees (avoid N+1)
  const allAvailability = await db.select().from(availability);
  const availabilityByEmployeeId = new Map<
    string,
    (typeof availability.$inferSelect)[]
  >();
  allAvailability.forEach((avail) => {
    if (!availabilityByEmployeeId.has(avail.employeeId)) {
      availabilityByEmployeeId.set(avail.employeeId, []);
    }
    availabilityByEmployeeId.get(avail.employeeId)!.push(avail);
  });

  // Batch fetch approved time-off requests (check for any overlap with date range)
  const approvedTimeOff = await db
    .select()
    .from(timeOffRequests)
    .where(eq(timeOffRequests.status, "approved"));

  const timeOffByEmployeeId = buildTimeOffMap(approvedTimeOff, fromDate, toDate);

  // Batch fetch existing shift assignments to calculate hours (exclude unpublished shifts)
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
        eq(shifts.isPublished, true) // Only count published shifts
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

  // Track assigned employees to prevent double-assignment
  const assignedEmployeeSet = new Set<string>();

  // For each shift, try to assign employees
  for (const shift of unassignedShifts) {
    const roleRequirements = roleRequirementsByShiftId.get(shift.id) || [];

    if (roleRequirements.length === 0) {
      // No role requirements: assign any available employee
      const candidate = findBestCandidate(
        shift,
        allEmployees,
        null,
        hoursPerEmployee,
        timeOffByEmployeeId,
        availabilityByEmployeeId,
        assignedEmployeeSet
      );

      if (candidate) {
        const newAssignment: AutoAssignResult = {
          shiftId: shift.id,
          employeeId: candidate.employeeId,
          jobRoleId: null,
        };
        assignments.push(newAssignment);
        assignedEmployeeSet.add(candidate.employeeId);

        const shiftHours = getShiftHours(shift);
        hoursPerEmployee.set(
          candidate.employeeId,
          (hoursPerEmployee.get(candidate.employeeId) || 0) + shiftHours
        );
      }
    } else {
      // Assign per role requirement
      for (const req of roleRequirements) {
        for (let i = 0; i < req.headcount; i++) {
          const candidate = findBestCandidate(
            shift,
            allEmployees,
            req.jobRoleId,
            hoursPerEmployee,
            timeOffByEmployeeId,
            availabilityByEmployeeId,
            assignedEmployeeSet
          );

          if (candidate) {
            const newAssignment: AutoAssignResult = {
              shiftId: shift.id,
              employeeId: candidate.employeeId,
              jobRoleId: req.jobRoleId,
            };
            assignments.push(newAssignment);
            assignedEmployeeSet.add(candidate.employeeId);

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
      console.error("Failed to insert shift assignments:", error);
      throw new Error("Failed to persist shift assignments to database");
    }
  }

  return assignments;
}

function buildTimeOffMap(
  requests: (typeof timeOffRequests.$inferSelect)[],
  fromDate: Date,
  toDate: Date
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const normalizedFrom = fromDate.toISOString().split("T")[0];
  const normalizedTo = toDate.toISOString().split("T")[0];

  requests.forEach((req) => {
    // Check if time-off overlaps with the date range
    const reqStartStr = req.startDate.toString();
    const reqEndStr = req.endDate.toString();

    if (reqEndStr < normalizedFrom || reqStartStr > normalizedTo) {
      return; // No overlap
    }

    if (!map.has(req.employeeId)) {
      map.set(req.employeeId, new Set());
    }

    // Add all dates within the overlap range
    const start = new Date(
      Math.max(
        new Date(normalizedFrom).getTime(),
        new Date(reqStartStr).getTime()
      )
    );
    const end = new Date(
      Math.min(new Date(normalizedTo).getTime(), new Date(reqEndStr).getTime())
    );

    for (
      let d = new Date(start);
      d <= end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      map.get(req.employeeId)!.add(d.toISOString().split("T")[0]);
    }
  });

  return map;
}

function getShiftHours(shift: typeof shifts.$inferSelect): number {
  return (
    (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) /
    (1000 * 60 * 60)
  );
}

function convertTimestampToTimeString(date: Date, timezone: string = "UTC"): string {
  const utcHours = String(date.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${utcHours}:${utcMinutes}`;
}

function isAvailableForShift(
  shift: typeof shifts.$inferSelect,
  empAvailability: (typeof availability.$inferSelect)[]
): boolean {
  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);
  const shiftDayOfWeek = shiftStart.getUTCDay();
  const shiftStartTime = convertTimestampToTimeString(shiftStart);
  const shiftEndTime = convertTimestampToTimeString(shiftEnd);

  return empAvailability.some(
    (avail) =>
      avail.dayOfWeek === shiftDayOfWeek &&
      avail.startTime <= shiftStartTime &&
      avail.endTime >= shiftEndTime
  );
}

function findBestCandidate(
  shift: typeof shifts.$inferSelect,
  allEmployees: (typeof employees.$inferSelect)[],
  requiredJobRoleId: string | null,
  hoursPerEmployee: Map<string, number>,
  timeOffByEmployeeId: Map<string, Set<string>>,
  availabilityByEmployeeId: Map<string, (typeof availability.$inferSelect)[]>,
  assignedEmployeeSet: Set<string>
): EmployeeCandidate | null {
  const shiftHours = getShiftHours(shift);
  const shiftDate = new Date(shift.startTime).toISOString().split("T")[0];

  const candidates: EmployeeCandidate[] = [];

  for (const emp of allEmployees) {
    // Skip if already assigned to this shift
    if (assignedEmployeeSet.has(emp.id)) {
      continue;
    }

    // Skip if employee has time-off on this day
    const timeOffDates = timeOffByEmployeeId.get(emp.id) || new Set();
    if (timeOffDates.has(shiftDate)) {
      continue;
    }

    // Skip if assigning would exceed max hours
    const currentHours = hoursPerEmployee.get(emp.id) || 0;
    if (currentHours + shiftHours > (emp.maxHoursPerWeek || 40)) {
      continue;
    }

    // Check availability for this day/time
    const empAvailability = availabilityByEmployeeId.get(emp.id) || [];
    if (!isAvailableForShift(shift, empAvailability)) {
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
