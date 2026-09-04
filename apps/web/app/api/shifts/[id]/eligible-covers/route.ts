import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, branches, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, ne } from "drizzle-orm";

// GET /api/employees only ever returns an "employee"-role caller's own
// record (the full roster is manager/admin-only, for privacy — see that
// route's comment), so the mobile app has no way to list coworkers when
// building a shift-swap request. This endpoint fills that one gap: given a
// shift, it returns the minimal id/name list of employees eligible to cover
// it, mirroring the same branch/active check POST /api/shift-swaps already
// enforces server-side.
export const GET = withAuth(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  const { id } = await params;

  const [row] = await db
    .select({ shift: shifts, branch: branches })
    .from(shifts)
    .innerJoin(branches, eq(shifts.branchId, branches.id))
    .where(and(eq(shifts.id, id), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [self] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  const conditions = [
    eq(employees.organizationId, user.organizationId),
    eq(employees.branchId, row.branch.id),
    eq(employees.isActive, true),
  ];
  if (self) conditions.push(ne(employees.id, self.id));

  const covers = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(and(...conditions));

  return NextResponse.json(covers);
});
