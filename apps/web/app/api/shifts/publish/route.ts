import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { shifts, branches } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const publishSchema = z.object({
  branchId: z.string().uuid(),
  weekStart: z.string().datetime(),
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { branchId, weekStart } = parsed.data;

  const [branch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, user.organizationId)))
    .limit(1);

  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || user.branchId !== branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  await db
    .update(shifts)
    .set({ isPublished: true })
    .where(
      and(
        eq(shifts.branchId, branchId),
        gte(shifts.startTime, start),
        lte(shifts.startTime, new Date(end.getTime() - 1))
      )
    );

  return NextResponse.json({ ok: true });
});
