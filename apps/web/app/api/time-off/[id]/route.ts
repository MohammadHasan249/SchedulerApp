import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { timeOffRequests, employees, shifts, shiftAssignments } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createNotification } from "@/lib/notifications";
import { sendTimeOffDecisionEmail } from "@/lib/email/send-time-off-decision-email";
import { eq, and, gte, lte } from "drizzle-orm";

const patchSchema = z.object({
  status: z.enum(["approved", "denied"]),
});

async function getRequest(id: string, user: Awaited<ReturnType<typeof getUser>>) {
  const [row] = await db
    .select({ req: timeOffRequests, emp: employees })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(and(eq(timeOffRequests.id, id), eq(employees.organizationId, user.organizationId)))
    .limit(1);
  return row ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const row = await getRequest(id, user);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || row.emp.branchId !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(timeOffRequests)
      .set({ status: parsed.data.status })
      .where(eq(timeOffRequests.id, id))
      .returning();

    // On approval, unassign the employee from any conflicting shifts in the date range.
    if (parsed.data.status === "approved") {
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      end.setHours(23, 59, 59, 999);

      const conflictingAssignments = await tx
        .select({ id: shiftAssignments.id })
        .from(shiftAssignments)
        .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
        .where(
          and(
            eq(shiftAssignments.employeeId, row.employeeId),
            gte(shifts.startTime, start),
            lte(shifts.startTime, end)
          )
        );

      if (conflictingAssignments.length > 0) {
        for (const a of conflictingAssignments) {
          await tx.delete(shiftAssignments).where(eq(shiftAssignments.id, a.id));
        }
      }
    }

    return row;
  });

  // Notify the employee of the decision. createNotification swallows its own
  // errors, so awaiting only adds the commit latency — not extra failure modes.
  await createNotification({
    employeeId: updated.employeeId,
    organizationId: user.organizationId,
    message:
      parsed.data.status === "approved"
        ? `Your time-off request for ${updated.startDate} – ${updated.endDate} was approved.`
        : `Your time-off request for ${updated.startDate} – ${updated.endDate} was denied.`,
  });

  // Best-effort email — failures here shouldn't fail the approval/denial itself.
  try {
    await sendTimeOffDecisionEmail(
      row.emp.email,
      row.emp.name,
      parsed.data.status,
      updated.startDate,
      updated.endDate,
      user.organizationId
    );
  } catch (error) {
    logger.error("Failed to send time-off decision email:", error);
  }

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  // Only employees can cancel their own requests; managers use PATCH to approve/deny
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [req] = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.employeeId, emp.id)))
    .limit(1);

  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(timeOffRequests).where(eq(timeOffRequests.id, id));
  return new NextResponse(null, { status: 204 });
});
