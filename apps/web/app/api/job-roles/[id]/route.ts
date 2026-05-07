import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jobRoles } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
});

async function getRole(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(jobRoles)
    .where(and(eq(jobRoles.id, id), eq(jobRoles.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (user.role !== "org_admin" && user.role !== "branch_manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await getRole(id, user.organizationId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(role);
  }

  const [updated] = await db
    .update(jobRoles)
    .set(parsed.data)
    .where(eq(jobRoles.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await getRole(id, user.organizationId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(jobRoles).where(eq(jobRoles.id, id));
  return new NextResponse(null, { status: 204 });
});
