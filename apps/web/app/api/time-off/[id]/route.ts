import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { timeOffRequests, employees } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

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

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(timeOffRequests)
    .set({ status: parsed.data.status })
    .where(eq(timeOffRequests.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  // Only employees can cancel their own pending requests; managers use PATCH to approve/deny
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
  if (req.status !== "pending") return NextResponse.json({ error: "Cannot cancel a non-pending request" }, { status: 409 });

  await db.delete(timeOffRequests).where(eq(timeOffRequests.id, id));
  return new NextResponse(null, { status: 204 });
});
