import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { shiftSwapRequests, employees, shifts, branches, shiftAssignments } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createNotification } from "@/lib/notifications";
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

    // GET /api/employees only ever returns this caller's own record, so the
    // client has no way to label these cards with the other party's name.
    // Denormalize it here instead — this only reveals the name of whoever
    // is on the other side of a swap the employee is already part of, not
    // the org roster.
    const otherIds = [
      ...new Set(
        rows.flatMap((r) => [r.requesterId, r.coverId]).filter((id): id is string => !!id)
      ),
    ];
    const nameRows =
      otherIds.length > 0
        ? await db.select({ id: employees.id, name: employees.name }).from(employees).where(inArray(employees.id, otherIds))
        : [];
    const nameById = Object.fromEntries(nameRows.map((e) => [e.id, e.name]));

    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        requesterName: nameById[r.requesterId] ?? null,
        coverName: r.coverId ? (nameById[r.coverId] ?? null) : null,
      }))
    );
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

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
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

  if (coverId) {
    await createNotification({
      employeeId: coverId,
      organizationId: user.organizationId,
      message: `${emp.name} has asked you to cover one of their shifts.`,
    });
  }

  return NextResponse.json(swap, { status: 201 });
});
