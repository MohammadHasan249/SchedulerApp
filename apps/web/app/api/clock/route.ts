import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { clockEvents, employees, branches } from "@scheduler/database/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getZonedDayStart } from "@/lib/utils/timezone";
import { logger } from "@/lib/logger";

const CLOCK_RATE_LIMIT = { maxAttempts: 10, windowMs: 5 * 60 * 1000 };

export const GET = withAuth(async function GET(request: Request) {
  const user = await getUser();
  if (user.role === "employee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limitParam = searchParams.get("limit");
  const cursor = searchParams.get("cursor"); // ISO timestamp — fetch events older than this
  const limit = Math.min(parseInt(limitParam ?? "100", 10) || 100, 500);

  if (user.role === "branch_manager" && !user.branchId) {
    return NextResponse.json({ data: [], nextCursor: null });
  }

  const allowedBranchIds =
    user.role === "branch_manager"
      ? [user.branchId!]
      : (
          await db
            .select({ id: branches.id })
            .from(branches)
            .where(eq(branches.organizationId, user.organizationId))
        ).map((b) => b.id);

  const targetBranchIds =
    branchId && allowedBranchIds.includes(branchId) ? [branchId] : allowedBranchIds;

  if (targetBranchIds.length === 0) return NextResponse.json({ data: [], nextCursor: null });

  const conditions = [inArray(clockEvents.branchId, targetBranchIds)];

  if (from) conditions.push(gte(clockEvents.timestamp, new Date(from)));
  if (to) conditions.push(lte(clockEvents.timestamp, new Date(to)));
  if (cursor) conditions.push(lte(clockEvents.timestamp, new Date(cursor)));

  if (cursor) {
    conditions.push(lte(clockEvents.timestamp, new Date(cursor)));
  }

  const rows = await db
    .select({ event: clockEvents, employee: employees })
    .from(clockEvents)
    .innerJoin(employees, eq(clockEvents.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(clockEvents.timestamp))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].event.timestamp.toISOString() : null;

  return NextResponse.json({ data, nextCursor });
});

const clockSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  branchSlug: z.string().min(1),
});

export const POST = withAuth(async function POST(request: Request) {
  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = clockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { pin, branchSlug } = parsed.data;

  // App-layer brute-force defense. Keyed by IP+branchSlug so one tampered
  // kiosk can't lock out the whole branch's clock-in by another kiosk on a
  // different network. Pair with infrastructure-level rate limiting in prod.
  const rateKey = `clock:${getClientIp(request)}:${branchSlug}`;
  const rl = await checkRateLimit(rateKey, CLOCK_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  // Find branch by slug
  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.slug, branchSlug))
    .limit(1);

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  // Find all active users who can clock in at this branch:
  //   - employees/managers assigned to this branch
  //   - org_admins of this branch's organization (no branch assignment required)
  // Single query, only fetch fields we actually need.
  const candidates = await db
    .select({
      id: employees.id,
      name: employees.name,
      branchId: employees.branchId,
      role: employees.role,
      pinHash: employees.pinHash,
    })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, branch.organizationId),
        eq(employees.isActive, true)
      )
    );

  const allUsers = candidates.filter(
    (e) => e.pinHash && (e.branchId === branch.id || e.role === "org_admin")
  );

  // Find ALL matching employees/admins by bcrypt comparing — we walk the full
  // list (no early break) so we can detect PIN collisions and refuse to clock
  // anyone in if more than one person has the same PIN.
  const matches: (typeof allUsers)[number][] = [];
  for (const emp of allUsers) {
    if (emp.pinHash && (await bcrypt.compare(pin, emp.pinHash))) {
      matches.push(emp);
    }
  }

  // Dummy compare to keep timing roughly constant when no candidates exist
  if (matches.length === 0 && allUsers.length === 0) {
    await bcrypt.compare(pin, "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.QvE2mLQ9cqYQUoxWZqXOZkS/GeNi");
  }

  if (matches.length === 0) {
    // Artificial delay to slow brute-force; pair with infrastructure-level rate limiting
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (matches.length > 1) {
    // Legacy data: two people collided. Refuse rather than guess.
    logger.error(
      "PIN collision detected at clock-in",
      matches.map((m) => m.id)
    );
    return NextResponse.json(
      {
        error:
          "PIN matches multiple accounts. Ask a manager to reset one of them, then try again.",
      },
      { status: 409 }
    );
  }

  const matchedEmployee = matches[0];

  // Use the branch's timezone for the day boundary, not the server's. Without
  // this, a Tokyo branch on a UTC server would see "today" start at 09:00 JST
  // and misclassify late-night/early-morning clock_in/clock_out toggles.
  const dayStart = getZonedDayStart(branch.timezone);

  const [lastEvent] = await db
    .select()
    .from(clockEvents)
    .where(
      and(
        eq(clockEvents.employeeId, matchedEmployee.id),
        gte(clockEvents.timestamp, dayStart)
      )
    )
    .orderBy(desc(clockEvents.timestamp))
    .limit(1);

  const clockType = lastEvent?.type === "clock_in" ? "clock_out" : "clock_in";

  const [event] = await db
    .insert(clockEvents)
    .values({
      employeeId: matchedEmployee.id,
      branchId: branch.id,
      type: clockType,
    })
    .returning();

  return NextResponse.json({
    employeeName: matchedEmployee.name,
    clockType,
    timestamp: event.timestamp,
  });
});
