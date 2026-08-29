import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { branches, employees, shifts } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { requireOrgAdmin, assertBranchScope } from "@/lib/auth/policies";
import { eq, and, gte } from "drizzle-orm";

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

  const { id } = await params;

  const denied = assertBranchScope(user, id);
  if (denied) return denied;

  const branch = await getBranch(id, user.organizationId);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
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
    .where(and(eq(branches.id, id), eq(branches.organizationId, user.organizationId)))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();

  const denied = requireOrgAdmin(user);
  if (denied) return denied;

  const { id } = await params;
  const branch = await getBranch(id, user.organizationId);
  if (!branch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refuse if any active employee is still attached — silent stranding produced
  // JWT/DB drift and accidental scope escalation in the AI route.
  const [stillAttached] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.branchId, id), eq(employees.isActive, true)))
    .limit(1);
  if (stillAttached) {
    return NextResponse.json(
      {
        error:
          "This branch still has active employees. Move them to another branch (or deactivate them) before deleting.",
      },
      { status: 409 }
    );
  }

  // Refuse if any upcoming shift would be silently destroyed by the cascade.
  const [upcoming] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.branchId, id), gte(shifts.startTime, new Date())))
    .limit(1);
  if (upcoming) {
    return NextResponse.json(
      {
        error:
          "This branch has upcoming shifts scheduled. Cancel or move them before deleting the branch.",
      },
      { status: 409 }
    );
  }

  await db.delete(branches).where(and(eq(branches.id, id), eq(branches.organizationId, user.organizationId)));
  return new NextResponse(null, { status: 204 });
});
