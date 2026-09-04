import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { branches, schedulingRules } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { assertBranchScope } from "@/lib/auth/policies";
import { eq, and } from "drizzle-orm";

const createSchema = z.object({
  branchId: z.string().uuid(),
  ruleText: z.string().min(1),
});

export const GET = withAuth(async function GET(request: Request) {
  const user = await getUser();
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });
  }

  const denied = assertBranchScope(user, branchId);
  if (denied) return denied;

  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1);
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(schedulingRules)
    .where(eq(schedulingRules.branchId, branchId));

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const denied = assertBranchScope(user, parsed.data.branchId);
  if (denied) return denied;

  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, parsed.data.branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1);
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const [rule] = await db
    .insert(schedulingRules)
    .values({ branchId: parsed.data.branchId, ruleText: parsed.data.ruleText })
    .returning();

  return NextResponse.json(rule, { status: 201 });
});
