import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import bcryptjs from "bcryptjs";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { pinCollidesWithExisting, withPinLock } from "@/lib/employees";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { eq, and } from "drizzle-orm";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
});

// Setting a PIN runs an O(N) bcrypt collision scan. Cap attempts per-user so a
// compromised session can't be used to DoS the box.
const PIN_SET_RATE_LIMIT = { maxAttempts: 5, windowMs: 5 * 60 * 1000 };

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const rl = await checkRateLimit(`pin-set:${getClientIp(request)}:${user.id}`, PIN_SET_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many PIN changes. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  // Users can only update their own PIN
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.authUserId, user.id)))
    .limit(1);

  if (!employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = pinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Locked so a second PIN-set for this org can't read "no collision" before
  // this one's write commits (see withPinLock).
  const result = await withPinLock(employee.organizationId, async (tx) => {
    const collides = await pinCollidesWithExisting(
      parsed.data.pin,
      employee.id,
      employee.organizationId,
      employee.branchId,
      tx
    );
    if (collides) return null;

    const pinHash = await bcryptjs.hash(parsed.data.pin, 10);
    const [updated] = await tx
      .update(employees)
      .set({ pinHash })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  });

  if (!result) {
    // Deliberately generic — confirming "someone else already has this PIN"
    // would let a caller enumerate which PINs are live at the branch.
    return NextResponse.json(
      { error: "That PIN can't be used. Try a different one." },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true, name: result.name });
});
