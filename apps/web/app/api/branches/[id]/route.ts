import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().nullable().optional(),
  timezone: z.string().optional(),
});

async function getBranch(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const branch = await getBranch(id, user.organizationId);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.slug && parsed.data.slug !== branch.slug) {
    const [existing] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.organizationId, user.organizationId), eq(branches.slug, parsed.data.slug)))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "A branch with this slug already exists" }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(branches)
    .set(parsed.data)
    .where(eq(branches.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const branch = await getBranch(id, user.organizationId);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(branches).where(and(eq(branches.id, id), eq(branches.organizationId, user.organizationId)));
  return new NextResponse(null, { status: 204 });
});
