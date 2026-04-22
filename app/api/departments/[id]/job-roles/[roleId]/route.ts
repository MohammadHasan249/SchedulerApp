import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jobRoles, departments, branches } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({ name: z.string().min(1) });

async function verifyRoleAccess(id: string, roleId: string, user: Awaited<ReturnType<typeof getUser>>) {
  const [row] = await db
    .select({ roleId: jobRoles.id })
    .from(jobRoles)
    .innerJoin(departments, eq(jobRoles.departmentId, departments.id))
    .innerJoin(branches, eq(departments.branchId, branches.id))
    .where(
      and(
        eq(jobRoles.id, roleId),
        eq(departments.id, id),
        eq(branches.organizationId, user.organizationId),
        ...(user.role === "branch_manager" && user.branchId
          ? [eq(branches.id, user.branchId)]
          : [])
      )
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, roleId } = await params;
  const access = await verifyRoleAccess(id, roleId, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(jobRoles)
    .set({ name: parsed.data.name })
    .where(eq(jobRoles.id, roleId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, roleId } = await params;
  const access = await verifyRoleAccess(id, roleId, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(jobRoles).where(eq(jobRoles.id, roleId));
  return new NextResponse(null, { status: 204 });
}
