import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { timeOffRequests, employees } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { sendTimeOffNotification } from "@/lib/email/send-time-off-notification";
import { eq, and, inArray } from "drizzle-orm";

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

  const [req] = await db
    .insert(timeOffRequests)
    .values({ employeeId: emp.id, startDate, endDate, reason })
    .returning();

  // Send notification email (non-blocking)
  sendTimeOffNotification(emp.id, user.organizationId, startDate, endDate, reason).catch((error) => {
    console.error("Failed to send time-off notification:", error);
  });

  return NextResponse.json(req, { status: 201 });
});
