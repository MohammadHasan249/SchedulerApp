import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { shifts, branches, shiftAssignments, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

const MIN_SHIFT_DURATION_MINUTES = 15;
const MAX_SHIFT_DURATION_HOURS = 24;

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

  if ((user.role === "branch_manager" || user.role === "employee") && !user.branchId) {
    return NextResponse.json([]);
  }

  const branchIds =
    user.role === "branch_manager" || user.role === "employee"
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

  // Ordered explicitly — without this, row order is whatever Postgres's scan
  // happens to return (not insertion order, not chronological), which is
  // invisible with one shift a day but scrambles a busy day's list once a
  // branch has several. Neither the web nor mobile client sorts client-side.
  const rows = await db
    .select({
      id: shifts.id,
      branchId: shifts.branchId,
      startTime: shifts.startTime,
      endTime: shifts.endTime,
      isPublished: shifts.isPublished,
    })
    .from(shifts)
    .where(and(...conditions))
    .orderBy(shifts.startTime);

  if (rows.length === 0) {
    return NextResponse.json(rows);
  }

  // Include assignments with employee names. Employees only ever receive
  // published shifts (filtered above), and the per-shift assignments
  // endpoint already lets them view assignments on published shifts, so
  // this exposes nothing new — it lets clients mark "your" shifts.
  const shiftIds = rows.map((s) => s.id);
  const assignmentRows = await db
    .select({
      id: shiftAssignments.id,
      shiftId: shiftAssignments.shiftId,
      employeeId: shiftAssignments.employeeId,
      employeeName: employees.name,
      jobRoleId: shiftAssignments.jobRoleId,
    })
    .from(shiftAssignments)
    .innerJoin(employees, eq(shiftAssignments.employeeId, employees.id))
    .where(inArray(shiftAssignments.shiftId, shiftIds));

  const byShift = new Map<string, typeof assignmentRows>();
  for (const a of assignmentRows) {
    if (!byShift.has(a.shiftId)) byShift.set(a.shiftId, []);
    byShift.get(a.shiftId)!.push(a);
  }

  return NextResponse.json(
    rows.map((s) => ({ ...s, assignments: byShift.get(s.id) ?? [] }))
  );
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { branchId, startTime, endTime } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (!(start < end)) {
    return NextResponse.json(
      { error: "Shift end time must be after start time" },
      { status: 400 }
    );
  }

  // Matches the lock enforced on assign/edit/delete ([id]/route.ts,
  // [id]/assign/route.ts) — without this, creating a shift that starts in
  // the past succeeds, but assigning an employee to it in the same flow
  // (mobile's Add Shift form does both back-to-back) then 409s on that lock,
  // leaving an orphaned, unassigned shift that can't be deleted either.
  if (start < new Date()) {
    return NextResponse.json({ error: "Past shifts are locked" }, { status: 409 });
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs < MIN_SHIFT_DURATION_MINUTES * 60 * 1000) {
    return NextResponse.json(
      { error: `Shift must be at least ${MIN_SHIFT_DURATION_MINUTES} minutes long` },
      { status: 400 }
    );
  }

  const durationHours = durationMs / (1000 * 60 * 60);
  if (durationHours > MAX_SHIFT_DURATION_HOURS) {
    return NextResponse.json(
      { error: `Shift duration cannot exceed ${MAX_SHIFT_DURATION_HOURS} hours` },
      { status: 400 }
    );
  }

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

  // Reject exact-duplicate shift at the same branch (same start AND end time).
  const [duplicate] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(
      and(
        eq(shifts.branchId, branchId),
        eq(shifts.startTime, start),
        eq(shifts.endTime, end)
      )
    )
    .limit(1);
  if (duplicate) {
    return NextResponse.json(
      { error: "An identical shift already exists at this branch" },
      { status: 409 }
    );
  }

  const [shift] = await db
    .insert(shifts)
    .values({
      branchId,
      startTime: start,
      endTime: end,
    })
    .returning();

  return NextResponse.json(shift, { status: 201 });
});
