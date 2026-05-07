import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { shifts, branches } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

const patchSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
});

async function getShift(id: string, organizationId: string) {
  const [row] = await db
    .select({ shift: shifts, branch: branches })
    .from(shifts)
    .innerJoin(branches, eq(shifts.branchId, branches.id))
    .where(and(eq(shifts.id, id), eq(branches.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getShift(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Past shifts are locked
  if (row.shift.startTime < new Date()) {
    return NextResponse.json({ error: "Past shifts are locked" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Partial<typeof shifts.$inferInsert> = {};
  if (parsed.data.startTime) updates.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) updates.endTime = new Date(parsed.data.endTime);
  if (parsed.data.isPublished !== undefined) updates.isPublished = parsed.data.isPublished;

  const [updated] = await db.update(shifts).set(updates).where(eq(shifts.id, id)).returning();
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getShift(id, user.organizationId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || row.branch.id !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.shift.startTime < new Date()) {
    return NextResponse.json({ error: "Past shifts are locked" }, { status: 409 });
  }

  await db.delete(shifts).where(eq(shifts.id, id));
  return new NextResponse(null, { status: 204 });
});
