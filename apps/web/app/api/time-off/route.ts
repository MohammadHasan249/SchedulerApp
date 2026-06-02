import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { timeOffRequests, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { sendTimeOffNotification } from "@/lib/email/send-time-off-notification";
import { eq, and, inArray, gte, lte, ne } from "drizzle-orm";

const MAX_TIME_OFF_DAYS = 90;

const createSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().optional(),
});

export const GET = withAuth(async function GET() {
  const user = await getUser();

  if (user.role === "employee") {
    // Employee sees only their own requests
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1);

    if (!emp) return NextResponse.json([]);

    const rows = await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.employeeId, emp.id));

    return NextResponse.json(rows);
  }

  // Manager/admin sees requests from their visible employees
  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json([]);
  }
  const empConditions = [eq(employees.organizationId, user.organizationId)];
  if (user.role === "branch_manager") {
    empConditions.push(eq(employees.branchId, user.branchId!));
  }

  const empRows = await db.select({ id: employees.id }).from(employees).where(and(...empConditions));
  const empIds = empRows.map((e) => e.id);

  if (empIds.length === 0) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(timeOffRequests)
    .where(inArray(timeOffRequests.employeeId, empIds));

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { startDate, endDate, reason } = parsed.data;

  if (startDate > endDate) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }

  // Reject past requests (compared by ISO date string — safe lexicographically).
  const today = new Date().toISOString().split("T")[0];
  if (startDate < today) {
    return NextResponse.json({ error: "Cannot request time off in the past" }, { status: 400 });
  }

  // Enforce a soft cap on duration.
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
  if (days > MAX_TIME_OFF_DAYS) {
    return NextResponse.json(
      { error: `Time off cannot exceed ${MAX_TIME_OFF_DAYS} days in a single request` },
      { status: 400 }
    );
  }

  // Reject overlap with this employee's existing pending or approved requests.
  const overlapping = await db
    .select({ id: timeOffRequests.id })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.employeeId, emp.id),
        ne(timeOffRequests.status, "denied"),
        lte(timeOffRequests.startDate, endDate),
        gte(timeOffRequests.endDate, startDate)
      )
    )
    .limit(1);
  if (overlapping.length > 0) {
    return NextResponse.json(
      { error: "You already have a pending or approved time-off request that overlaps these dates" },
      { status: 409 }
    );
  }

  const [req] = await db
    .insert(timeOffRequests)
    .values({ employeeId: emp.id, startDate, endDate, reason })
    .returning();

  // Send notification email. sendTimeOffNotification swallows its own errors,
  // so awaiting only adds latency — no new failure modes.
  await sendTimeOffNotification(emp.id, user.organizationId, startDate, endDate, reason);

  return NextResponse.json(req, { status: 201 });
});
