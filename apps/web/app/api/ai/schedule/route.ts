import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  employees,
  branches,
  jobRoles,
  timeOffRequests,
} from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const MAX_SHIFT_HOURS = 10;

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

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  async function getScopedBranchIds(): Promise<string[]> {
    if (user.role === "branch_manager" && user.branchId) return [user.branchId];
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
    if (user.role === "branch_manager" && user.branchId) {
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

    // Fetch shift
    const [shiftRow] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, input.shiftId), inArray(shifts.branchId, branchIds)))
      .limit(1);
    if (!shiftRow) return { error: "Shift not found or out of scope" };

    const start = new Date(shiftRow.startTime);
    const end = new Date(shiftRow.endTime);
    const hours = shiftHours(start, end);

    // ── Constraint 1: 10-hour maximum ────────────────────────────────────────
    if (hours > MAX_SHIFT_HOURS) {
      return {
        error: `Shift is ${Math.round(hours * 10) / 10}h, which exceeds the ${MAX_SHIFT_HOURS}-hour maximum. Cannot assign.`,
      };
    }

    // Fetch employee
    const empConditions = [
      eq(employees.id, input.employeeId),
      eq(employees.organizationId, user.organizationId),
    ];
    if (user.role === "branch_manager" && user.branchId) {
      empConditions.push(eq(employees.branchId, user.branchId));
    }
    const [emp] = await db
      .select({
        id: employees.id,
        maxHoursPerWeek: employees.maxHoursPerWeek,
        availabilitySchedule: employees.availabilitySchedule,
      })
      .from(employees)
      .where(and(...empConditions))
      .limit(1);
    if (!emp) return { error: "Employee not found or out of scope" };

    // ── Constraint 2: Availability window ────────────────────────────────────
    const schedule = emp.availabilitySchedule as Record<
      string,
      { startTime: string; endTime: string }
    > | null;

    const dayOfWeek = start.getDay(); // 0=Sun…6=Sat
    const slot = schedule?.[String(dayOfWeek)];

    if (!slot) {
      return { error: "Employee has no availability set for that day." };
    }

    // Compare HH:MM times
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const shiftStartMin = start.getHours() * 60 + start.getMinutes();
    const shiftEndMin = end.getHours() * 60 + end.getMinutes();
    const availStartMin = toMinutes(slot.startTime);
    const availEndMin = toMinutes(slot.endTime);

    if (shiftStartMin < availStartMin || shiftEndMin > availEndMin) {
      return {
        error: `Employee is only available ${slot.startTime}–${slot.endTime} on that day. Shift is outside their availability window.`,
      };
    }

    // ── Constraint 3: Approved time off ──────────────────────────────────────
    const shiftDate = start.toISOString().split("T")[0];
    const [timeOff] = await db
      .select({ id: timeOffRequests.id })
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.employeeId, input.employeeId),
          eq(timeOffRequests.status, "approved"),
          lte(timeOffRequests.startDate, shiftDate),
          gte(timeOffRequests.endDate, shiftDate)
        )
      )
      .limit(1);

    if (timeOff) {
      return { error: "Employee has approved time off on that day." };
    }

    // ── Constraint 4: Weekly hour cap ─────────────────────────────────────────
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weekAssignments =
      branchIds.length > 0
        ? await db
            .select({ startTime: shifts.startTime, endTime: shifts.endTime })
            .from(shiftAssignments)
            .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .where(
              and(
                eq(shiftAssignments.employeeId, input.employeeId),
                inArray(shifts.branchId, branchIds),
                gte(shifts.startTime, weekStart),
                lte(shifts.startTime, weekEnd)
              )
            )
        : [];

    const currentHours = weekAssignments.reduce(
      (sum, a) => sum + shiftHours(new Date(a.startTime), new Date(a.endTime)),
      0
    );
    const maxHours = emp.maxHoursPerWeek ?? 40;

    if (currentHours + hours > maxHours) {
      return {
        error: `Assigning this shift would bring employee to ${Math.round((currentHours + hours) * 10) / 10}h this week, exceeding their ${maxHours}h cap.`,
      };
    }

    // ── All checks passed — insert ────────────────────────────────────────────
    const [assignment] = await db
      .insert(shiftAssignments)
      .values({
        shiftId: input.shiftId,
        employeeId: input.employeeId,
        jobRoleId: input.jobRoleId ?? null,
      })
      .returning();

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
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
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

    if (!res.ok) {
      console.error("DeepSeek error:", await res.text());
      return NextResponse.json({ error: "AI service error" }, { status: 500 });
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) break;

    messages.push(msg);

    if (choice.finish_reason === "tool_calls" && msg.tool_calls?.length) {
      const toolResults: DeepSeekMessage[] = await Promise.all(
        msg.tool_calls.map(async (tc: DeepSeekToolCall) => {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = await executeTool(tc.function.name, args);
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        })
      );
      messages.push(...toolResults);
    } else {
      return NextResponse.json({ reply: msg.content ?? "" });
    }
  }

  return NextResponse.json({ reply: "I wasn't able to complete that request. Please try again." });
});
