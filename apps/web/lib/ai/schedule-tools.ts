import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  employees,
  branches,
  jobRoles,
} from "@scheduler/database/schema";
import type { AppUser } from "@/lib/auth/getUser";
import { validateAssignment } from "@/lib/scheduling/assignment-validator";
import { createNotification } from "@/lib/notifications";
import { formatZonedDateTime, formatZonedDateTimeWithWeekday, getZonedWeekStart, zonedTimeToUtc } from "@/lib/utils/timezone";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export const MAX_SHIFT_HOURS = 10;

/**
 * Builds the schedule assistant's tool set for a single request, scoped to
 * `user`. Real database IDs (UUIDs) must never reach the model or the chat
 * transcript — every real ID handed to the model is replaced with a short
 * opaque handle (e.g. "shift_1"), resolved back to the real ID when the model
 * calls a tool. The handle registry and branch-timezone cache are request-scoped
 * (closed over here), matching how the original hand-rolled loop worked.
 */
export function buildScheduleTools(user: AppUser) {
  const handleToId = new Map<string, string>();
  const idToHandle = new Map<string, string>();
  const handleCounters: Record<string, number> = {};

  function toHandle(prefix: string, id: string): string {
    const existing = idToHandle.get(id);
    if (existing) return existing;
    const n = (handleCounters[prefix] ?? 0) + 1;
    handleCounters[prefix] = n;
    const handle = `${prefix}_${n}`;
    handleToId.set(handle, id);
    idToHandle.set(id, handle);
    return handle;
  }

  function fromHandle(handle: string | null | undefined): string | undefined {
    if (!handle) return undefined;
    return handleToId.get(handle);
  }

  async function getScopedBranchIds(): Promise<string[]> {
    if (user.role === "branch_manager") {
      // A branch_manager whose branch was deleted has user.branchId === null;
      // do NOT fall through to all-branches scope. Return empty so they can't
      // see or modify any data until they're reassigned.
      return user.branchId ? [user.branchId] : [];
    }
    return (
      await db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.organizationId, user.organizationId))
    ).map((b) => b.id);
  }

  // Times are meaningless to the model (and to the user reading its replies)
  // in UTC — everything shown to or reasoned about by the AI must be in the
  // relevant branch's local time. Cache each branch's timezone once per request.
  //
  // Caches the in-flight *promise*, not just the resolved value — list_shifts
  // calls this concurrently (once per shift, via Promise.all), and a
  // check-then-set-after-await cache would let every one of those concurrent
  // calls miss the cache and fire its own duplicate SELECT before any of them
  // finish populating it.
  const branchTimezoneCache = new Map<string, Promise<string>>();
  function getBranchTimezone(branchId: string): Promise<string> {
    const cached = branchTimezoneCache.get(branchId);
    if (cached) return cached;
    const promise = (async () => {
      const [row] = await db
        .select({ timezone: branches.timezone })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);
      return row?.timezone ?? "UTC";
    })();
    branchTimezoneCache.set(branchId, promise);
    return promise;
  }

  function shiftHours(start: Date, end: Date) {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  // The AI SDK executes all tool calls within a single model step concurrently
  // (Promise.all), not sequentially like the original hand-rolled loop did. If
  // the model emits two `assign_employee` calls in one turn (e.g. "assign Jane
  // and Bob to Monday's shift"), both would read pre-mutation state, both pass
  // validateAssignment, and both insert — bypassing headcount/hour caps. Every
  // mutating tool call is serialized through this per-request queue so only
  // one runs its read-validate-write section at a time, restoring the old
  // sequential guarantee without fighting the SDK's concurrency model.
  let mutationQueue: Promise<unknown> = Promise.resolve();
  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(fn, fn);
    mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  const tools = {
    list_job_roles: tool({
      description: "List all job roles for this organization (e.g. Cook, Waiter, Cashier).",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select({ id: jobRoles.id, name: jobRoles.name })
          .from(jobRoles)
          .where(eq(jobRoles.organizationId, user.organizationId));
        return rows.map((r) => ({ id: toHandle("role", r.id), name: r.name }));
      },
    }),

    list_branches: tool({
      description: "List branches in scope. Only needed when creating a shift and more than one branch exists.",
      inputSchema: z.object({}),
      execute: async () => {
        const branchIds = await getScopedBranchIds();
        if (branchIds.length === 0) return [];
        const rows = await db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(inArray(branches.id, branchIds));
        return rows.map((b) => ({ id: toHandle("branch", b.id), name: b.name }));
      },
    }),

    list_shifts: tool({
      description:
        "List upcoming shifts (next 2 weeks) for this branch, including duration, who is already assigned, and whether they are within the 10-hour maximum.",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const branchIds = await getScopedBranchIds();
        if (branchIds.length === 0) return [];

        const shiftRows = await db
          .select()
          .from(shifts)
          .where(
            and(
              inArray(shifts.branchId, branchIds),
              gte(shifts.startTime, now),
              lte(shifts.startTime, twoWeeksOut)
            )
          );

        if (shiftRows.length === 0) return [];

        const shiftIds = shiftRows.map((s) => s.id);
        const assignmentRows = await db
          .select({
            id: shiftAssignments.id,
            shiftId: shiftAssignments.shiftId,
            employeeId: shiftAssignments.employeeId,
            employeeName: employees.name,
            jobRoleId: shiftAssignments.jobRoleId,
          })
          .from(shiftAssignments)
          .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
          .where(inArray(shiftAssignments.shiftId, shiftIds));

        const byShift = new Map<string, typeof assignmentRows>();
        for (const a of assignmentRows) {
          if (!byShift.has(a.shiftId)) byShift.set(a.shiftId, []);
          byShift.get(a.shiftId)!.push(a);
        }

        return Promise.all(
          shiftRows.map(async (s) => {
            const hours = shiftHours(new Date(s.startTime), new Date(s.endTime));
            const timezone = await getBranchTimezone(s.branchId);
            return {
              id: toHandle("shift", s.id),
              branchId: toHandle("branch", s.branchId),
              // Branch-local wall-clock time, not UTC — the model must reason about
              // shifts in the timezone the organization actually operates in.
              // Weekday is spelled out explicitly so the model never has to
              // recompute day-of-week from the date itself (it gets this wrong).
              startTime: formatZonedDateTimeWithWeekday(s.startTime, timezone),
              endTime: formatZonedDateTime(s.endTime, timezone),
              timezone,
              durationHours: Math.round(hours * 10) / 10,
              exceedsMaxHours: hours > MAX_SHIFT_HOURS,
              isPublished: s.isPublished,
              assignments: (byShift.get(s.id) ?? []).map((a) => ({
                id: toHandle("assignment", a.id),
                employeeId: toHandle("employee", a.employeeId),
                employeeName: a.employeeName,
                jobRoleId: a.jobRoleId ? toHandle("role", a.jobRoleId) : null,
              })),
            };
          })
        );
      },
    }),

    list_employees: tool({
      description:
        "List active employees in scope with their job role, weekly availability windows, and current scheduled hours this week.",
      inputSchema: z.object({}),
      execute: async () => {
        const conditions = [
          eq(employees.organizationId, user.organizationId),
          eq(employees.isActive, true),
        ];
        if (user.role === "branch_manager") {
          // Same safeguard as getScopedBranchIds — no branch ⇒ no scope.
          if (!user.branchId) return [];
          conditions.push(eq(employees.branchId, user.branchId));
        }

        const rows = await db
          .select({
            id: employees.id,
            name: employees.name,
            jobRoleId: employees.jobRoleId,
            maxHoursPerWeek: employees.maxHoursPerWeek,
            availabilitySchedule: employees.availabilitySchedule,
          })
          .from(employees)
          .where(and(...conditions));

        if (rows.length === 0) return [];

        const roleRows = await db
          .select({ id: jobRoles.id, name: jobRoles.name })
          .from(jobRoles)
          .where(eq(jobRoles.organizationId, user.organizationId));
        const roleMap = new Map(roleRows.map((r) => [r.id, r.name]));

        // Current week scheduled hours (published shifts only). Week boundaries are
        // computed per-branch in that branch's own timezone, matching how auto-assign
        // and availability checks resolve "this week" — not the server's UTC clock.
        const branchIds = await getScopedBranchIds();
        const empIds = rows.map((e) => e.id);
        let weekAssignments: { employeeId: string; startTime: Date; endTime: Date }[] = [];
        if (branchIds.length > 0 && empIds.length > 0) {
          // Week boundaries differ per branch timezone, so this can't be one
          // batched query across branches — but the per-branch queries are
          // independent, so run them concurrently rather than one round-trip
          // at a time (most orgs have 1-2 branches, but this scales linearly
          // otherwise, and it's on the hot path of every list_employees call).
          const perBranch = await Promise.all(
            branchIds.map(async (branchId) => {
              const timezone = await getBranchTimezone(branchId);
              const weekStart = getZonedWeekStart(timezone);
              const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
              return db
                .select({
                  employeeId: shiftAssignments.employeeId,
                  startTime: shifts.startTime,
                  endTime: shifts.endTime,
                })
                .from(shiftAssignments)
                .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
                .where(
                  and(
                    inArray(shiftAssignments.employeeId, empIds),
                    eq(shifts.branchId, branchId),
                    gte(shifts.startTime, weekStart),
                    lte(shifts.startTime, weekEnd),
                    eq(shifts.isPublished, true)
                  )
                );
            })
          );
          weekAssignments = perBranch.flat();
        }

        const hoursMap = new Map<string, number>();
        for (const a of weekAssignments) {
          const h = shiftHours(new Date(a.startTime), new Date(a.endTime));
          hoursMap.set(a.employeeId, (hoursMap.get(a.employeeId) ?? 0) + h);
        }

        return rows.map((e) => ({
          id: toHandle("employee", e.id),
          name: e.name,
          jobRoleId: e.jobRoleId ? toHandle("role", e.jobRoleId) : null,
          jobRoleName: e.jobRoleId ? (roleMap.get(e.jobRoleId) ?? null) : null,
          maxHoursPerWeek: e.maxHoursPerWeek ?? 40,
          currentWeekHours: Math.round((hoursMap.get(e.id) ?? 0) * 10) / 10,
          availability: e.availabilitySchedule,
        }));
      },
    }),

    create_shift: tool({
      description:
        "Create a new shift. Returns an error if the shift would exceed 10 hours or the branch is out of scope.",
      inputSchema: z.object({
        branchId: z
          .string()
          .optional()
          .describe(
            "The branch reference (from list_branches) to create the shift in. Optional if there is only one branch in scope."
          ),
        startTime: z
          .string()
          .describe(
            'Local start time in the branch\'s own timezone, as it would read on a wall clock there — e.g. "2026-06-01T09:00:00". Not UTC.'
          ),
        endTime: z
          .string()
          .describe(
            'Local end time in the branch\'s own timezone, as it would read on a wall clock there — e.g. "2026-06-01T17:00:00". Not UTC.'
          ),
        isPublished: z
          .boolean()
          .optional()
          .describe("Whether the shift should be published immediately. Defaults to false."),
      }),
      execute: (input) =>
        serialize(async () => {
          const branchIds = await getScopedBranchIds();
          if (branchIds.length === 0) return { error: "No branch in scope" };

          let branchId: string;
          if (input.branchId) {
            const resolved = fromHandle(input.branchId);
            if (!resolved || !branchIds.includes(resolved)) {
              return { error: "Branch not found or out of scope. Call list_branches to get a valid reference." };
            }
            branchId = resolved;
          } else if (branchIds.length === 1) {
            branchId = branchIds[0];
          } else {
            return { error: "Multiple branches in scope — call list_branches and specify branchId." };
          }

          const timezone = await getBranchTimezone(branchId);
          const startTime = zonedTimeToUtc(input.startTime, timezone);
          const endTime = zonedTimeToUtc(input.endTime, timezone);
          if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
            return { error: "Invalid startTime/endTime" };
          }

          const hours = shiftHours(startTime, endTime);
          if (hours > MAX_SHIFT_HOURS) {
            return {
              error: `Shift would be ${Math.round(hours * 10) / 10}h, which exceeds the ${MAX_SHIFT_HOURS}-hour maximum. Cannot create.`,
            };
          }

          const [shift] = await db
            .insert(shifts)
            .values({
              branchId,
              startTime,
              endTime,
              isPublished: input.isPublished ?? false,
            })
            .returning();

          return { success: true, shiftId: toHandle("shift", shift.id) };
        }),
    }),

    assign_employee: tool({
      description:
        "Assign an employee to a shift. Returns an error if the shift exceeds 10 hours, the employee is unavailable, has approved time off, or would exceed their weekly hour cap.",
      inputSchema: z.object({
        shiftId: z.string().describe("The shift reference (from list_shifts or create_shift) to assign to."),
        employeeId: z.string().describe("The employee reference (from list_employees) to assign."),
        jobRoleId: z
          .string()
          .optional()
          .describe("Optional job role reference (from list_job_roles) for this assignment."),
      }),
      execute: (input) =>
        serialize(async () => {
          const branchIds = await getScopedBranchIds();

          const shiftId = fromHandle(input.shiftId);
          if (!shiftId) return { error: "Shift not found. Call list_shifts to get a valid reference." };
          const employeeId = fromHandle(input.employeeId);
          if (!employeeId) return { error: "Employee not found. Call list_employees to get a valid reference." };
          const jobRoleId = input.jobRoleId ? fromHandle(input.jobRoleId) : null;
          if (input.jobRoleId && !jobRoleId) {
            return { error: "Job role not found. Call list_job_roles to get a valid reference." };
          }

          const [shiftRow] = await db
            .select()
            .from(shifts)
            .where(and(eq(shifts.id, shiftId), inArray(shifts.branchId, branchIds)))
            .limit(1);
          if (!shiftRow) return { error: "Shift not found or out of scope" };

          const hours = shiftHours(new Date(shiftRow.startTime), new Date(shiftRow.endTime));
          if (hours > MAX_SHIFT_HOURS) {
            return {
              error: `Shift is ${Math.round(hours * 10) / 10}h, which exceeds the ${MAX_SHIFT_HOURS}-hour maximum. Cannot assign.`,
            };
          }

          const empConditions = [
            eq(employees.id, employeeId),
            eq(employees.organizationId, user.organizationId),
          ];
          if (user.role === "branch_manager") {
            if (!user.branchId) return { error: "Branch manager has no branch assigned" };
            empConditions.push(eq(employees.branchId, user.branchId));
          }
          const [emp] = await db
            .select()
            .from(employees)
            .where(and(...empConditions))
            .limit(1);
          if (!emp) return { error: "Employee not found or out of scope" };

          const [branchRow] = await db
            .select({ timezone: branches.timezone })
            .from(branches)
            .where(eq(branches.id, shiftRow.branchId))
            .limit(1);

          const validation = await validateAssignment(shiftRow, emp, branchRow?.timezone ?? "UTC");
          if (!validation.ok) {
            return { error: validation.message };
          }

          const [assignment] = await db
            .insert(shiftAssignments)
            .values({
              shiftId,
              employeeId,
              jobRoleId: jobRoleId ?? null,
            })
            .returning();

          await createNotification({
            employeeId: emp.id,
            organizationId: user.organizationId,
            message: `You've been assigned to a shift starting ${formatZonedDateTime(shiftRow.startTime, branchRow?.timezone ?? "UTC")}.`,
          });

          return {
            success: true,
            assignmentId: toHandle("assignment", assignment.id),
            shiftId: toHandle("shift", shiftId),
            employeeId: toHandle("employee", employeeId),
          };
        }),
    }),

    unassign_employee: tool({
      description: "Remove an employee assignment from a shift.",
      inputSchema: z.object({
        assignmentId: z.string().describe("The assignment reference (from list_shifts) to remove."),
      }),
      execute: (input) =>
        serialize(async () => {
          const assignmentId = fromHandle(input.assignmentId);
          if (!assignmentId) return { error: "Assignment not found. Call list_shifts to get a valid reference." };

          const [row] = await db
            .select({ shiftId: shiftAssignments.shiftId })
            .from(shiftAssignments)
            .where(eq(shiftAssignments.id, assignmentId))
            .limit(1);
          if (!row) return { error: "Assignment not found" };

          const branchIds = await getScopedBranchIds();
          const [shift] = await db
            .select({ id: shifts.id })
            .from(shifts)
            .where(and(eq(shifts.id, row.shiftId), inArray(shifts.branchId, branchIds)))
            .limit(1);
          if (!shift) return { error: "Assignment out of scope" };

          await db.delete(shiftAssignments).where(eq(shiftAssignments.id, assignmentId));
          return { success: true };
        }),
    }),
  };

  return { tools, getScopedBranchIds, getBranchTimezone };
}
