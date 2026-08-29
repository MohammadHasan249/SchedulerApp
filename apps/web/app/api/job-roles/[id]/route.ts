import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { jobRoles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { requireOrgAdmin, requireManagerOrAdmin } from "@/lib/auth/policies";
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

  const denied = requireManagerOrAdmin(user);
  if (denied) return denied;

  const role = await getRole(id, user.organizationId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(role);
  }

  const [updated] = await db
    .update(jobRoles)
    .set(parsed.data)
    .where(and(eq(jobRoles.id, id), eq(jobRoles.organizationId, user.organizationId)))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const denied = requireOrgAdmin(user);
  if (denied) return denied;

  const role = await getRole(id, user.organizationId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(jobRoles).where(and(eq(jobRoles.id, id), eq(jobRoles.organizationId, user.organizationId)));
  return new NextResponse(null, { status: 204 });
});
