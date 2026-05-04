import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import {
  shifts,
  shiftAssignments,
  employees,
  availability,
  timeOffRequests,
  shiftRoleRequirements,
} from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const autoAssignSchema = z.object({
  branchId: z.string().uuid(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
});

export async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json(
      { error: "Branch manager must have a branch assigned" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = autoAssignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { branchId, fromDate, toDate } = parsed.data;

  // Branch managers can only auto-assign their own branch
  if (user.role === "branch_manager" && branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);

    // Fetch all necessary data
    const [unassignedShifts, allEmployees, allAvailability, approvedTimeOff, roleRequirements] =
      await Promise.all([
        db
          .select()
          .from(shifts)
          .where(
            and(
              eq(shifts.branchId, branchId),
              gte(shifts.startTime, fromDateObj),
              lte(shifts.endTime, toDateObj),
              eq(shifts.isPublished, false)
            )
          ),
        db.select().from(employees).where(and(eq(employees.organizationId, user.organizationId), eq(employees.isActive, true))),
        db.select().from(availability),
        db
          .select()
          .from(timeOffRequests)
          .where(eq(timeOffRequests.status, "approved")),
        db.select().from(shiftRoleRequirements),
      ]);

    if (unassignedShifts.length === 0) {
      return NextResponse.json({
        success: true,
        assignmentsCreated: 0,
        assignments: [],
      });
    }

    // Build availability map
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

    // Build time-off map
    const timeOffByEmployeeId = new Map<string, Set<string>>();
    approvedTimeOff.forEach((req) => {
      const reqStartStr = req.startDate.toString();
      const reqEndStr = req.endDate.toString();
      const normalizedFrom = fromDateObj.toISOString().split("T")[0];
      const normalizedTo = toDateObj.toISOString().split("T")[0];

      if (reqEndStr >= normalizedFrom && reqStartStr <= normalizedTo) {
        if (!timeOffByEmployeeId.has(req.employeeId)) {
          timeOffByEmployeeId.set(req.employeeId, new Set());
        }

        const start = new Date(Math.max(new Date(normalizedFrom).getTime(), new Date(reqStartStr).getTime()));
        const end = new Date(Math.min(new Date(normalizedTo).getTime(), new Date(reqEndStr).getTime()));

        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          timeOffByEmployeeId.get(req.employeeId)!.add(d.toISOString().split("T")[0]);
        }
      }
    });

    // Calculate existing hours
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
          eq(shifts.isPublished, true)
        )
      );

    const hoursPerEmployee = new Map<string, number>();
    existingAssignments.forEach(({ employeeId, startTime, endTime }) => {
      const hours =
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
      hoursPerEmployee.set(
        employeeId,
        (hoursPerEmployee.get(employeeId) || 0) + hours
      );
    });

    // Build data for LLM
    const shiftsData = unassignedShifts.map((s) => {
      const roleReqs = roleRequirements.filter((r) => r.shiftId === s.id);
      return {
        id: s.id,
        startTime: new Date(s.startTime).toISOString(),
        endTime: new Date(s.endTime).toISOString(),
        roleRequirements: roleReqs.map((r) => ({ jobRoleId: r.jobRoleId, headcount: r.headcount })),
      };
    });

    const employeesData = allEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      jobRoleId: e.jobRoleId,
      maxHoursPerWeek: e.maxHoursPerWeek || 40,
      currentHours: hoursPerEmployee.get(e.id) || 0,
      availability: availabilityByEmployeeId.get(e.id) || [],
      timeOff: Array.from(timeOffByEmployeeId.get(e.id) || new Set()),
    }));

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "AI assign is not configured (DEEPSEEK_API_KEY missing)" }, { status: 503 });
    }

    // Call DeepSeek (very cost-efficient model)
    const prompt = `You are a workforce scheduling expert. Given shifts and employees, assign employees to shifts optimally.

SHIFTS TO ASSIGN:
${JSON.stringify(shiftsData, null, 2)}

EMPLOYEES:
${JSON.stringify(employeesData, null, 2)}

CONSTRAINTS:
1. Respect availability windows (day of week + time)
2. Don't assign if employee has time-off
3. Don't assign if it exceeds maxHoursPerWeek
4. Prioritize job role matches
5. Balance hours across employees (prefer fewer hours)
6. Don't assign same employee twice to same shift

Return ONLY a valid JSON array of assignments. Each assignment has: shiftId, employeeId, jobRoleId (null if no specific role needed).
Example: [{"shiftId":"shift-1","employeeId":"emp-1","jobRoleId":null}]
Return empty array [] if no valid assignments possible.`;

    const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!deepseekResponse.ok) {
      console.error("DeepSeek API error:", await deepseekResponse.text());
      return NextResponse.json(
        { error: "Failed to call DeepSeek API" },
        { status: 500 }
      );
    }

    const deepseekData = await deepseekResponse.json();
    const responseText =
      deepseekData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse LLM response" },
        { status: 500 }
      );
    }

    const assignments = JSON.parse(jsonMatch[0]);

    // Validate and insert assignments
    if (assignments.length > 0) {
      const validAssignments = assignments.filter(
        (a: any) =>
          typeof a.shiftId === "string" &&
          typeof a.employeeId === "string" &&
          unassignedShifts.some((s) => s.id === a.shiftId) &&
          allEmployees.some((e) => e.id === a.employeeId)
      );

      if (validAssignments.length > 0) {
        await db.insert(shiftAssignments).values(validAssignments);
      }
    }

    return NextResponse.json(
      {
        success: true,
        assignmentsCreated: assignments.length,
        assignments,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in LLM auto-assign:", error);
    return NextResponse.json(
      { error: "Failed to assign shifts with LLM" },
      { status: 500 }
    );
  }
}
