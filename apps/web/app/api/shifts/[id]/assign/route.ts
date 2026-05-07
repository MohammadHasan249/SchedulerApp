import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { shifts, shiftAssignments, branches, employees } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

const assignSchema = z.object({
  employeeId: z.string().uuid(),
  jobRoleId: z.string().uuid().nullable().optional(),
});

const unassignSchema = z.object({
  assignmentId: z.string().uuid(),
});

async function getShift(id: string, organizationId: string) {
  const [row] = await db
    .select({ shift: shifts, branch: branches })
    .from(shifts)
    .innerJoin(branches, eq(shifts.branchId, branches.id))
    .where(and(eq(shifts.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const GET = withAuth(async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const row = await getShift(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Employees can only view assignments for published shifts in their own branch
  if (user.role === "employee") {
    if (!row.shift.isPublished) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assignments = await db
    .select()
    .from(shiftAssignments)
    .where(eq(shiftAssignments.shiftId, id));

  return NextResponse.json(assignments);
});

export const POST = withAuth(async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getShift(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.shift.startTime < new Date()) {
    return NextResponse.json({ error: "Past shifts are locked" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify employee belongs to same org
  const [employee] = await db
    .select({ id: employees.id, branchId: employees.branchId })
    .from(employees)
    .where(and(eq(employees.id, parsed.data.employeeId), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Branch managers can only assign employees from their own branch
  if (user.role === "branch_manager" && employee.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [assignment] = await db
    .insert(shiftAssignments)
    .values({
      shiftId: id,
      employeeId: parsed.data.employeeId,
      jobRoleId: parsed.data.jobRoleId ?? null,
    })
    .returning();

  return NextResponse.json(assignment, { status: 201 });
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getShift(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.shift.startTime < new Date()) {
    return NextResponse.json({ error: "Past shifts are locked" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = unassignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await db.delete(shiftAssignments).where(
    and(
      eq(shiftAssignments.id, parsed.data.assignmentId),
      eq(shiftAssignments.shiftId, id)
    )
  );

  return new NextResponse(null, { status: 204 });
});
