import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { availability, employees } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const putSchema = z.array(slotSchema);

async function verifyEmployeeAccess(
  employeeId: string,
  user: Awaited<ReturnType<typeof getUser>>
) {
  const conditions = [
    eq(employees.id, employeeId),
    eq(employees.organizationId, user.organizationId),
  ];
  if (user.role === "branch_manager" && user.branchId) {
    conditions.push(eq(employees.branchId, user.branchId));
  }
  if (user.role === "employee") {
    // Employees can only view/edit their own availability
    conditions.push(eq(employees.authUserId, user.id));
  }
  const [row] = await db.select({ id: employees.id }).from(employees).where(and(...conditions)).limit(1);
  return row ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const user = await getUser();
  const { employeeId } = await params;

  const emp = await verifyEmployeeAccess(employeeId, user);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.select().from(availability).where(eq(availability.employeeId, employeeId));
  return NextResponse.json(rows);
}

export async function PUT(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const user = await getUser();
  const { employeeId } = await params;

  const emp = await verifyEmployeeAccess(employeeId, user);
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const invalid = parsed.data.find((s) => s.startTime >= s.endTime);
  if (invalid) {
    return NextResponse.json({ error: "Start time must be before end time" }, { status: 400 });
  }

  // Replace all availability for this employee
  await db.delete(availability).where(eq(availability.employeeId, employeeId));

  if (parsed.data.length > 0) {
    await db.insert(availability).values(
      parsed.data.map((slot) => ({ employeeId, ...slot }))
    );
  }

  const rows = await db.select().from(availability).where(eq(availability.employeeId, employeeId));
  return NextResponse.json(rows);
}
