import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { employees, organizations } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { BRANDS, isWrongBrandOrgForVariant, type BrandKey } from "@/lib/brand";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  appVariant: z.enum(Object.keys(BRANDS) as [BrandKey, ...BrandKey[]]),
});

const LOGIN_RATE_LIMIT = { maxAttempts: 10, windowMs: 15 * 60 * 1000 };

// Mobile can't sign in via Supabase directly and check the brand client-side
// after the fact — auth is shared across both app variants' orgs, so a valid
// Seau de Crabe login would still succeed in the Workplix build (and vice
// versa), leaving the device briefly holding a live session before it
// noticed and signed itself back out. This route does the brand check here,
// server-side, before any session is ever handed to the device.
export async function POST(request: Request) {
  const rl = await checkRateLimit(`mobile-login:${getClientIp(request)}`, LOGIN_RATE_LIMIT);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, password, appVariant } = parsed.data;

  // Same message for bad credentials and a brand mismatch — the point is
  // that a Seau de Crabe employee opening the Workplix app (or vice versa)
  // should never learn a second app exists.
  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return invalidCredentials();
  }

  // Resolved from the DB rather than the JWT's app_metadata: a user can hold
  // an active employee row in more than one org (see getUser.ts), so allow
  // the login through if ANY of their active memberships is compatible with
  // this app variant.
  const rows = await db
    .select({ slug: organizations.slug })
    .from(employees)
    .innerJoin(organizations, eq(organizations.id, employees.organizationId))
    .where(and(eq(employees.authUserId, data.user.id), eq(employees.isActive, true)));

  const hasCompatibleOrg =
    rows.length > 0 && rows.some((r) => !isWrongBrandOrgForVariant(appVariant as BrandKey, r.slug));

  if (!hasCompatibleOrg) {
    // Invalidate the session we just issued rather than leaving a live,
    // unused token behind.
    await supabase.auth.admin.signOut(data.session.access_token).catch(() => {});
    return invalidCredentials();
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
