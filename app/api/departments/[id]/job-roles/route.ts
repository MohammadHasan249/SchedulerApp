import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jobRoles, departments, branches } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

const createSchema = z.object({ name: z.string().min(1) });

async function verifyDeptAccess(deptId: string, user: Awaited<ReturnType<typeof getUser>>) {
  const [row] = await db
    .select({ deptId: departments.id, branchId: branches.id })
    .from(departments)
    .innerJoin(branches, eq(departments.branchId, branches.id))
    .where(and(eq(departments.id, deptId), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!row) return null;
  if (user.role === "branch_manager" && row.branchId !== user.branchId) return null;
  return row;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const access = await verifyDeptAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.select().from(jobRoles).where(eq(jobRoles.departmentId, id));
  return NextResponse.json(rows);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const access = await verifyDeptAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [role] = await db
    .insert(jobRoles)
    .values({ name: parsed.data.name, departmentId: id })
    .returning();

  return NextResponse.json(role, { status: 201 });
}
