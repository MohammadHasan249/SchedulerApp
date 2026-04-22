import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clockEvents, employees, branches } from "@/db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getUser } from "@/lib/auth/getUser";

export async function GET(request: Request) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Get visible branches
  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  const allowedBranchIds =
    user.role === "branch_manager" && user.branchId
      ? [user.branchId]
      : branchRows.map((b) => b.id);

  const targetBranchIds =
    branchId && allowedBranchIds.includes(branchId) ? [branchId] : allowedBranchIds;

  if (targetBranchIds.length === 0) return NextResponse.json([]);

  const conditions = [inArray(clockEvents.branchId, targetBranchIds)];

  if (from) conditions.push(gte(clockEvents.timestamp, new Date(from)));
  if (to) conditions.push(lte(clockEvents.timestamp, new Date(to)));

  const rows = await db
    .select({ event: clockEvents, employee: employees })
    .from(clockEvents)
    .innerJoin(employees, eq(clockEvents.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(clockEvents.timestamp));

  return NextResponse.json(rows);
}

const clockSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  branchSlug: z.string().min(1),
});

// Public route — no auth, uses service role via direct DB access
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = clockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { pin, branchSlug } = parsed.data;

  // Find branch by slug
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.slug, branchSlug))
    .limit(1);

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  // Find employees in this branch with a PIN set
  const branchEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.branchId, branch.id), eq(employees.isActive, true)));

  // Find the matching employee by bcrypt comparing
  let matchedEmployee: typeof employees.$inferSelect | null = null;
  for (const emp of branchEmployees) {
    if (emp.pinHash && await bcrypt.compare(pin, emp.pinHash)) {
      matchedEmployee = emp;
      break;
    }
  }

  if (!matchedEmployee) {
    // Artificial delay to slow brute-force; pair with infrastructure-level rate limiting
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  // Determine clock type: if last event today is clock_in → clock_out, else clock_in
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [lastEvent] = await db
    .select()
    .from(clockEvents)
    .where(
      and(
        eq(clockEvents.employeeId, matchedEmployee.id),
        gte(clockEvents.timestamp, dayStart)
      )
    )
    .orderBy(desc(clockEvents.timestamp))
    .limit(1);

  const clockType = lastEvent?.type === "clock_in" ? "clock_out" : "clock_in";

  const [event] = await db
    .insert(clockEvents)
    .values({
      employeeId: matchedEmployee.id,
      branchId: branch.id,
      type: clockType,
    })
    .returning();

  return NextResponse.json({
    employeeName: matchedEmployee.name,
    clockType,
    timestamp: event.timestamp,
  });
}
