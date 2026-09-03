import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { shifts, shiftAssignments, branches, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { validateAssignment } from "@/lib/scheduling/assignment-validator";
import { createNotification } from "@/lib/notifications";
import { formatZonedDateTime } from "@/lib/utils/timezone";
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

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify employee belongs to same org
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, parsed.data.employeeId), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  if (employee.role === "org_admin") {
    return NextResponse.json({ error: "Org admins cannot be assigned to shifts" }, { status: 403 });
  }

  // Employees can only be assigned to shifts in their own branch
  if (employee.branchId !== row.branch.id) {
    return NextResponse.json({ error: "Employee does not belong to this shift's branch" }, { status: 403 });
  }

  const validation = await validateAssignment(row.shift, employee, row.branch.timezone);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message, code: validation.code }, { status: 409 });
  }

  let assignment;
  try {
    [assignment] = await db
      .insert(shiftAssignments)
      .values({
        shiftId: id,
        employeeId: parsed.data.employeeId,
        jobRoleId: parsed.data.jobRoleId ?? null,
      })
      .returning();
  } catch (error) {
    // Two concurrent submits can both pass validateAssignment's duplicate
    // pre-check; the loser lands on shift_assignments_shift_emp_unique.
    if ((error as { code?: string })?.code === "23505") {
      return NextResponse.json(
        {
          error: "Employee is already assigned to this shift.",
          code: "DUPLICATE_ASSIGNMENT",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  await createNotification({
    employeeId: employee.id,
    organizationId: user.organizationId,
    message: `You've been assigned to a shift starting ${formatZonedDateTime(row.shift.startTime, row.branch.timezone)}.`,
  });

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

  const [body, jsonErr2] = await safeJson(request);
  if (jsonErr2) return jsonErr2;
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
