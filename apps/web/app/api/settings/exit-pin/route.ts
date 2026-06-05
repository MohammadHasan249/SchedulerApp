import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

const EXIT_PIN_RATE_LIMIT = { maxAttempts: 10, windowMs: 5 * 60 * 1000 };

export const PUT = withAuth(async function PUT(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
  }

  const exitPinHash = await bcrypt.hash(parsed.data.pin, 10);
  await db
    .update(organizations)
    .set({ exitPinHash })
    .where(eq(organizations.id, user.organizationId));

  return NextResponse.json({ ok: true });
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  // Brute-force defense — same pattern as /api/clock POST. Keyed by IP+org so a
  // single tampered kiosk can't lock out other kiosks at the same branch.
  const rl = checkRateLimit(
    `exit-pin:${getClientIp(request)}:${user.organizationId}`,
    EXIT_PIN_RATE_LIMIT
  );
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { valid: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const [body, jsonErr2] = await safeJson(request);
  if (jsonErr2) return jsonErr2;
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false });
  }

  const [org] = await db
    .select({ exitPinHash: organizations.exitPinHash })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  if (!org?.exitPinHash) {
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ valid: false });
  }

  const valid = await bcrypt.compare(parsed.data.pin, org.exitPinHash);
  if (!valid) await new Promise((r) => setTimeout(r, 1000));
  return NextResponse.json({ valid });
});
