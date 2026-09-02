import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { employees, organizations } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getBrandForHost, getBrandForOrgSlug } from "@/lib/brand";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const SIGNUP_RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const rl = await checkRateLimit(`signup:${getClientIp(request)}`, SIGNUP_RATE_LIMIT);
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const supabase = createAdminClient();

  // Web-only gate: which brand this specific request came in on (e.g.
  // seaudecrabe.workplix.app). Mobile always calls the same shared API host
  // regardless of variant, so this only restricts the web signup page.
  const hostBrand = getBrandForHost(request.headers.get("host"));

  // Check if employee was invited (exists in employees table). Email is only
  // unique per-org (UNIQUE(organization_id, email)), so on locked-org brand
  // domains filter to that org directly in the query rather than fetching an
  // arbitrary org's row for this email and checking after the fact.
  const emailCondition = eq(employees.email, email);
  const [employee] = await db
    .select({
      id: employees.id,
      organizationId: employees.organizationId,
      organizationSlug: organizations.slug,
      name: employees.name,
      role: employees.role,
      branchId: employees.branchId,
      authUserId: employees.authUserId,
    })
    .from(employees)
    .innerJoin(organizations, eq(organizations.id, employees.organizationId))
    .where(
      hostBrand.lockedOrgSlug
        ? and(emailCondition, eq(organizations.slug, hostBrand.lockedOrgSlug))
        : emailCondition
    )
    .limit(1);

  if (!employee) {
    return NextResponse.json(
      { error: "You haven't been invited to join an organization. Contact your administrator." },
      { status: 403 }
    );
  }

  // Email/link branding is based on the employee's own org, not the request
  // host — a Seau de Crabe employee signing up via the mobile app still hits
  // the shared www.workplix.app API host, but should get a Seau de Crabe
  // branded email regardless.
  const emailBrand = getBrandForOrgSlug(employee.organizationSlug);

  // If employee already has auth user linked, they should just log in
  if (employee.authUserId) {
    return NextResponse.json(
      { error: "Your account already exists. Please log in instead." },
      { status: 400 }
    );
  }

  // Try to create auth user. If they already exist (rare race or stale invite),
  // fall back to looking them up — but never return the existing record's data.
  let authUserId: string;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: employee.name },
    app_metadata: {
      role: employee.role,
      organization_id: employee.organizationId,
      branch_id: employee.branchId ?? null,
    },
  });

  if (authError) {
    // If the user already exists, refuse — they should log in instead.
    // Do NOT enumerate all users via listUsers().
    return NextResponse.json(
      { error: "Unable to complete signup. If you already have an account, please log in instead." },
      { status: 400 }
    );
  }

  authUserId = authData.user.id;

  // Link auth user to employee record
  await db
    .update(employees)
    .set({ authUserId })
    .where(eq(employees.id, employee.id));

  // admin.createUser() does not send a confirmation email by itself —
  // generate the confirmation link and send it ourselves via Resend
  // (Supabase's built-in email sending is not used).
  //
  // We link to our own /confirmed page with token_hash/type (verified via
  // verifyOtp) rather than the raw action_link: action_link's redirect uses
  // Supabase's implicit hash-token flow, but our browser client is hardcoded
  // to flowType "pkce" (see @supabase/ssr createBrowserClient), which
  // rejects those hash tokens — confirmation still succeeds server-side but
  // the page always showed "Confirmation failed".
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${emailBrand.appUrl}/confirmed` },
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    logger.error("Failed to generate signup confirmation link:", linkError);
  } else {
    const confirmUrl = `${emailBrand.appUrl}/confirmed?token_hash=${linkData.properties.hashed_token}&type=signup`;
    await sendConfirmationEmail(email, confirmUrl, employee.name, emailBrand);
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
