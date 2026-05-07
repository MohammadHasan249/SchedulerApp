import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { shifts, branches } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const createSchema = z.object({
  branchId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

async function getOrgBranchIds(organizationId: string) {
  const rows = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.organizationId, organizationId));
  return rows.map((r) => r.id);
}

export const GET = withAuth(async function GET(request: Request) {
  const user = await getUser();
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart"); // ISO date string

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json([]);
  }

  const branchIds =
    user.role === "branch_manager"
      ? [user.branchId!]
      : await getOrgBranchIds(user.organizationId);

  if (branchIds.length === 0) return NextResponse.json([]);

  const conditions = [inArray(shifts.branchId, branchIds)];

  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    conditions.push(gte(shifts.startTime, start));
    conditions.push(lte(shifts.startTime, new Date(end.getTime() - 1)));
  }

  // Employees only see published shifts
  if (user.role === "employee") {
    conditions.push(eq(shifts.isPublished, true));
  }

  const rows = await db
    .select({
      id: shifts.id,
      branchId: shifts.branchId,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      isPublished: shifts.isPublished,
    })
    .from(shifts)
    .where(and(...conditions));
  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { branchId, startTime, endTime } = parsed.data;

  // Verify branch ownership
  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || user.branchId !== branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [shift] = await db
    .insert(shifts)
    .values({
      branchId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    })
    .returning();

  return NextResponse.json(shift, { status: 201 });
});
