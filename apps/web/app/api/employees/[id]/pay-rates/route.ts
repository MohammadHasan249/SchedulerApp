import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { employees, payRates } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { userHasPermission } from "@/lib/auth/permissions";
import { eq, and, desc } from "drizzle-orm";

// Resolve the target employee within the caller's org, enforcing branch scope
// for managers. Returns null if not found / out of scope.
async function getScopedEmployee(
  id: string,
  user: Awaited<ReturnType<typeof getUser>>
) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, user.organizationId)))
    .limit(1);
  if (!row) return null;
  if (user.role === "branch_manager" && (!user.branchId || row.branchId !== user.branchId)) {
    return null;
  }
  return row;
}

export const GET = withAuth(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await userHasPermission(user, "salaries:view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const employee = await getScopedEmployee(id, user);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(payRates)
    .where(eq(payRates.employeeId, id))
    .orderBy(desc(payRates.effectiveDate), desc(payRates.createdAt));

  return NextResponse.json(rows);
});

const createSchema = z.object({
  payType: z.enum(["hourly", "salary"]),
  amountCents: z.number().int().positive(),
  currency: z.string().trim().min(3).max(3).toUpperCase().optional(),
  effectiveDate: z.string().date(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const POST = withAuth(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await userHasPermission(user, "salaries:edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const employee = await getScopedEmployee(id, user);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Attribute the entry to the acting user's employee record (audit trail).
  const [actor] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  const [created] = await db
    .insert(payRates)
    .values({
      employeeId: id,
      payType: parsed.data.payType,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency ?? "CAD",
      effectiveDate: parsed.data.effectiveDate,
      note: parsed.data.note ?? null,
      createdByEmployeeId: actor?.id ?? null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});
