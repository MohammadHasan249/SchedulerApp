import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  employees,
  branches,
  jobRoles,
} from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { validateAssignment } from "@/lib/scheduling/assignment-validator";
import { createNotification } from "@/lib/notifications/create";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const MAX_SHIFT_HOURS = 10;

const DEEPSEEK_TIMEOUT_MS = 30_000;
const AI_RATE_LIMIT = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_job_roles",
      description: "List all job roles for this organization (e.g. Cook, Waiter, Cashier).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_shifts",
      description:
        "List upcoming shifts (next 2 weeks) for this branch, including duration, who is already assigned, and whether they are within the 10-hour maximum.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_employees",
      description:
        "List active employees in scope with their job role, weekly availability windows, and current scheduled hours this week.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_employee",
      description:
        "Assign an employee to a shift. Returns an error if the shift exceeds 10 hours, the employee is unavailable, has approved time off, or would exceed their weekly hour cap.",
      parameters: {
        type: "object",
        properties: {
          shiftId: { type: "string", description: "The shift ID to assign to." },
          employeeId: { type: "string", description: "The employee ID to assign." },
          jobRoleId: { type: "string", description: "Optional job role ID for this assignment." },
        },
        required: ["shiftId", "employeeId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unassign_employee",
      description: "Remove an employee assignment from a shift.",
      parameters: {
        type: "object",
        properties: {
          assignmentId: { type: "string", description: "The assignment ID to remove." },
        },
        required: ["assignmentId"],
      },
    },
  },
];

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: "AI assistant is not configured." },
      { status: 503 }
    );
  }

  // Rate-limit by org. Each request can trigger up to 10 DeepSeek calls — left
  // unbounded, a single tab open in a browser could rack up real $ in minutes.
  const rl = await checkRateLimit(`ai:${user.organizationId}`, AI_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "AI quota exhausted for this hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

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

  function shiftHours(start: Date, end: Date) {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  // ── tool implementations ───────────────────────────────────────────────────

  async function toolListJobRoles() {
    return db
      .select({ id: jobRoles.id, name: jobRoles.name })
      .from(jobRoles)
      .where(eq(jobRoles.organizationId, user.organizationId));
  }

  async function toolListShifts() {
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

    return shiftRows.map((s) => {
      const hours = shiftHours(new Date(s.startTime), new Date(s.endTime));
      return {
        id: s.id,
        branchId: s.branchId,
        startTime: s.startTime,
        endTime: s.endTime,
        durationHours: Math.round(hours * 10) / 10,
        exceedsMaxHours: hours > MAX_SHIFT_HOURS,
        isPublished: s.isPublished,
        assignments: byShift.get(s.id) ?? [],
      };
    });
  }

  async function toolListEmployees() {
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

    // Current week scheduled hours (published shifts only)
    const branchIds = await getScopedBranchIds();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const empIds = rows.map((e) => e.id);
    const weekAssignments =
      branchIds.length > 0 && empIds.length > 0
        ? await db
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
                inArray(shifts.branchId, branchIds),
                gte(shifts.startTime, weekStart),
                lte(shifts.startTime, weekEnd),
                eq(shifts.isPublished, true)
              )
            )
        : [];

    const hoursMap = new Map<string, number>();
    for (const a of weekAssignments) {
      const h = shiftHours(new Date(a.startTime), new Date(a.endTime));
      hoursMap.set(a.employeeId, (hoursMap.get(a.employeeId) ?? 0) + h);
    }

    return rows.map((e) => ({
      id: e.id,
      name: e.name,
      jobRoleId: e.jobRoleId,
      jobRoleName: e.jobRoleId ? (roleMap.get(e.jobRoleId) ?? null) : null,
      maxHoursPerWeek: e.maxHoursPerWeek ?? 40,
      currentWeekHours: Math.round((hoursMap.get(e.id) ?? 0) * 10) / 10,
      availability: e.availabilitySchedule,
    }));
  }

  async function toolAssignEmployee(input: {
    shiftId: string;
    employeeId: string;
    jobRoleId?: string | null;
  }) {
    const branchIds = await getScopedBranchIds();

    const [shiftRow] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, input.shiftId), inArray(shifts.branchId, branchIds)))
      .limit(1);
    if (!shiftRow) return { error: "Shift not found or out of scope" };

    const hours = shiftHours(new Date(shiftRow.startTime), new Date(shiftRow.endTime));
    if (hours > MAX_SHIFT_HOURS) {
      return {
        error: `Shift is ${Math.round(hours * 10) / 10}h, which exceeds the ${MAX_SHIFT_HOURS}-hour maximum. Cannot assign.`,
      };
    }

    const empConditions = [
      eq(employees.id, input.employeeId),
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
        shiftId: input.shiftId,
        employeeId: input.employeeId,
        jobRoleId: input.jobRoleId ?? null,
      })
      .returning();

    await createNotification({
      employeeId: emp.id,
      organizationId: user.organizationId,
      message: `You've been assigned to a shift starting ${new Date(shiftRow.startTime).toLocaleString()}.`,
    });

    return { success: true, assignmentId: assignment.id };
  }

  async function toolUnassignEmployee(input: { assignmentId: string }) {
    const [row] = await db
      .select({ shiftId: shiftAssignments.shiftId })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.id, input.assignmentId))
      .limit(1);
    if (!row) return { error: "Assignment not found" };

    const branchIds = await getScopedBranchIds();
    const [shift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.id, row.shiftId), inArray(shifts.branchId, branchIds)))
      .limit(1);
    if (!shift) return { error: "Assignment out of scope" };

    await db.delete(shiftAssignments).where(eq(shiftAssignments.id, input.assignmentId));
    return { success: true };
  }

  async function executeTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "list_job_roles":    return toolListJobRoles();
      case "list_shifts":       return toolListShifts();
      case "list_employees":    return toolListEmployees();
      case "assign_employee":   return toolAssignEmployee(args as { shiftId: string; employeeId: string; jobRoleId?: string });
      case "unassign_employee": return toolUnassignEmployee(args as { assignmentId: string });
      default: return { error: `Unknown tool: ${name}` };
    }
  }

  // ── Agentic loop ──────────────────────────────────────────────────────────

  const systemPrompt = `You are a scheduling assistant for a workforce management app. You help managers assign employees to shifts.

Hard constraints enforced by the system (the assign_employee tool will reject violations with a clear error):
1. Shifts cannot exceed ${MAX_SHIFT_HOURS} hours.
2. Employees can only be assigned within their availability window for that day of week.
3. Employees with approved time off on a day cannot be assigned shifts that day.
4. Employees cannot exceed their maximum hours per week.

Your job:
- Use list_shifts and list_employees to understand what's available before assigning.
- Prefer employees whose job role matches what the shift needs.
- When a constraint blocks an assignment, explain why and suggest alternatives if possible.
- After completing assignments, summarize what was done (names, times, roles).
- Today is ${new Date().toDateString()}.`;

  type DeepSeekMessage =
    | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: DeepSeekToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };

  type DeepSeekToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  };

  const messages: DeepSeekMessage[] = [
    { role: "system", content: systemPrompt },
    ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content } as DeepSeekMessage)),
  ];

  for (let i = 0; i < 10; i++) {
    let res: Response;
    try {
      res = await fetch(DEEPSEEK_URL, {
        method: "POST",
        signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.3,
        }),
      });
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === "TimeoutError";
      logger.error(isTimeout ? "DeepSeek timeout" : "DeepSeek fetch failed:", e);
      return NextResponse.json(
        { error: isTimeout ? "AI service timed out" : "AI service unreachable" },
        { status: 504 }
      );
    }

    if (!res.ok) {
      logger.error("DeepSeek error:", await res.text());
      return NextResponse.json({ error: "AI service error" }, { status: 500 });
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) break;

    messages.push(msg);

    if (choice.finish_reason === "tool_calls" && msg.tool_calls?.length) {
      // Run tool calls sequentially. With Promise.all, the model can request
      // two `assign_employee` calls targeting the same shift in one turn; both
      // pass `validateAssignment` independently and both insert, blowing past
      // headcount caps. Sequential execution lets each call see the previous
      // call's mutation.
      const toolResults: DeepSeekMessage[] = [];
      for (const tc of msg.tool_calls as DeepSeekToolCall[]) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          toolResults.push({
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({ error: "Invalid tool arguments (malformed JSON)" }),
          });
          continue;
        }
        // A DB error inside a tool (e.g. a unique-constraint race on assign)
        // must come back as a tool error the model can react to, not a 500
        // that kills the whole conversation turn.
        let result: unknown;
        try {
          result = await executeTool(tc.function.name, args);
        } catch (e) {
          logger.error(`AI tool ${tc.function.name} failed:`, e);
          result = {
            error:
              "The operation failed unexpectedly. It may have hit a conflict — re-check current state before retrying.",
          };
        }
        toolResults.push({
          role: "tool" as const,
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      messages.push(...toolResults);
    } else {
      return NextResponse.json({ reply: msg.content ?? "" });
    }
  }

  return NextResponse.json({ reply: "I wasn't able to complete that request. Please try again." });
});
