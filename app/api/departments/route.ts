import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { departments, branches } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and, inArray } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1),
  branchId: z.string().uuid(),
});

async function getOrgBranchIds(organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.organizationId, organizationId));
  return rows.map((r) => r.id);
}

export async function GET() {
  const user = await getUser();

  const branchIds = user.role === "branch_manager" && user.branchId
    ? [user.branchId]
    : await getOrgBranchIds(user.organizationId);

  if (branchIds.length === 0) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(departments)
    .where(inArray(departments.branchId, branchIds));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, branchId } = parsed.data;

  // Verify the branch belongs to this org
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  if (user.role === "branch_manager" && user.branchId !== branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [dept] = await db.insert(departments).values({ name, branchId }).returning();
  return NextResponse.json(dept, { status: 201 });
}
