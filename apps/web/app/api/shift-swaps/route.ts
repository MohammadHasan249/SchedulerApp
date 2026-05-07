import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { shiftSwapRequests, employees, shifts, branches, shiftAssignments } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, or, inArray } from "drizzle-orm";

const createSchema = z.object({
  shiftId: z.string().uuid(),
  coverId: z.string().uuid().nullable().optional(),
});

async function getEmployeeForUser(userId: string, organizationId: string) {
  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.authUserId, userId), eq(employees.organizationId, organizationId)))
    .limit(1);
  return emp ?? null;
}

export const GET = withAuth(async function GET() {
  const user = await getUser();

  if (user.role === "employee") {
    const emp = await getEmployeeForUser(user.id, user.organizationId);
    if (!emp) return NextResponse.json([]);

    // See requests where they are requester or cover
    const rows = await db
      .select()
      .from(shiftSwapRequests)
      .where(or(eq(shiftSwapRequests.requesterId, emp.id), eq(shiftSwapRequests.coverId, emp.id)));

    return NextResponse.json(rows);
  }

  // Manager/admin sees all in their org/branch
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
    .from(shiftSwapRequests)
    .where(
      or(
        inArray(shiftSwapRequests.requesterId, empIds),
        inArray(shiftSwapRequests.coverId, empIds)
      )
    );

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  const emp = await getEmployeeForUser(user.id, user.organizationId);
  if (!emp) return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { shiftId, coverId } = parsed.data;

  // Verify requester is assigned to this shift and the shift is in their org
  const [shiftRow] = await db
    .select({ shift: shifts, branch: branches })
    .from(shifts)
    .innerJoin(branches, eq(shifts.branchId, branches.id))
    .where(and(eq(shifts.id, shiftId), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!shiftRow) return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  const [assignment] = await db
    .select()
    .from(shiftAssignments)
    .where(and(eq(shiftAssignments.shiftId, shiftId), eq(shiftAssignments.employeeId, emp.id)))
    .limit(1);

  if (!assignment) {
    return NextResponse.json({ error: "You are not assigned to this shift" }, { status: 409 });
  }

  // Ensure shift hasn't started
  if (new Date(shiftRow.shift.startTime) < new Date()) {
    return NextResponse.json({ error: "Cannot swap a past shift" }, { status: 409 });
  }

  // Verify nominated cover belongs to the same org and same branch as the shift
  if (coverId) {
    if (coverId === emp.id) {
      return NextResponse.json({ error: "Cannot nominate yourself as cover" }, { status: 400 });
    }
    const [coverEmp] = await db
      .select({ id: employees.id, branchId: employees.branchId })
      .from(employees)
      .where(and(eq(employees.id, coverId), eq(employees.organizationId, user.organizationId)))
      .limit(1);
    if (!coverEmp) return NextResponse.json({ error: "Cover employee not found" }, { status: 404 });
    if (coverEmp.branchId !== shiftRow.branch.id) {
      return NextResponse.json(
        { error: "Cover must be in the same branch as the shift" },
        { status: 409 }
      );
    }
  }

  const [swap] = await db
    .insert(shiftSwapRequests)
    .values({ shiftId, requesterId: emp.id, coverId: coverId ?? null })
    .returning();

  return NextResponse.json(swap, { status: 201 });
});
