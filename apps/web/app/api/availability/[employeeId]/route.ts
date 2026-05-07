import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

const slotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const scheduleSchema = z.record(z.string().regex(/^\d$/), slotSchema);

async function verifyEmployeeAccess(
  employeeId: string,
  user: Awaited<ReturnType<typeof getUser>>
) {
  const conditions = [
    eq(employees.id, employeeId),
    eq(employees.organizationId, user.organizationId),
  ];
  if (user.role === "branch_manager") {
    if (!user.branchId) return null;
    conditions.push(eq(employees.branchId, user.branchId));
  }
  if (user.role === "employee") {
    // Employees can only view/edit their own availability
    conditions.push(eq(employees.authUserId, user.id));
  }
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(...conditions)).limit(1);
  return row ?? null;
}

export const GET = withAuth(async function GET(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const user = await getUser();
  const { employeeId } = await params;

  const emp = await verifyEmployeeAccess(employeeId, user);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select({ availabilitySchedule: employees.availabilitySchedule })
    .from(employees)
    .where(eq(employees.id, employeeId));
  return NextResponse.json(row?.availabilitySchedule ?? {});
});

export const PUT = withAuth(async function PUT(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const user = await getUser();
  const { employeeId } = await params;

  const emp = await verifyEmployeeAccess(employeeId, user);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  for (const slot of Object.values(parsed.data)) {
    if (slot.startTime >= slot.endTime) {
      return NextResponse.json({ error: "Start time must be before end time" }, { status: 400 });
    }
  }

  const [updated] = await db
    .update(employees)
    .set({ availabilitySchedule: parsed.data })
    .where(eq(employees.id, employeeId))
    .returning({ availabilitySchedule: employees.availabilitySchedule });
  return NextResponse.json(updated?.availabilitySchedule ?? {});
});
