import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { departments, branches } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({ name: z.string().min(1) });

async function getDept(id: string, organizationId: string) {
  const [row] = await db
    .select({ dept: departments, branch: branches })
    .from(departments)
    .innerJoin(branches, eq(departments.branchId, branches.id))
    .where(and(eq(departments.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getDept(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && row.branch.id !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(departments)
    .set({ name: parsed.data.name })
    .where(eq(departments.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getDept(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && row.branch.id !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(departments).where(eq(departments.id, id));
  return new NextResponse(null, { status: 204 });
}
