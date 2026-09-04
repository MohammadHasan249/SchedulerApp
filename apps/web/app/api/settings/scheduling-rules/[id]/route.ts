import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { branches, schedulingRules } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { assertBranchScope } from "@/lib/auth/policies";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({
  ruleText: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

async function getRuleWithBranch(id: string, organizationId: string) {
  const [row] = await db
    .select({ rule: schedulingRules, branchId: branches.id })
    .from(schedulingRules)
    .innerJoin(branches, eq(schedulingRules.branchId, branches.id))
    .where(and(eq(schedulingRules.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const existing = await getRuleWithBranch(id, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const denied = assertBranchScope(user, existing.branchId);
  if (denied) return denied;

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(existing.rule);
  }

  const [updated] = await db
    .update(schedulingRules)
    .set(parsed.data)
    .where(eq(schedulingRules.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const existing = await getRuleWithBranch(id, user.organizationId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const denied = assertBranchScope(user, existing.branchId);
  if (denied) return denied;

  await db.delete(schedulingRules).where(eq(schedulingRules.id, id));
  return new NextResponse(null, { status: 204 });
});
