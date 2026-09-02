import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { organizations, employees, branches, jobRoles } from "@scheduler/database/schema";
import { slugify } from "@/lib/utils/slugify";
import { eq } from "drizzle-orm";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getBrandForHost } from "@/lib/brand";

const INDUSTRY_STARTER_JOB_ROLES: Record<"restaurant" | "retail" | "other", string[]> = {
  restaurant: ["Server", "Cook", "Cashier", "Shift Manager"],
  retail: ["Sales Associate", "Cashier", "Stock Associate", "Store Manager", "Shift Lead"],
  other: [],
};

const schema = z.object({
  orgName: z.string().min(2),
  orgSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  industry: z.enum(["restaurant", "retail", "other"]),
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const SIGNUP_RATE_LIMIT = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const brand = getBrandForHost(request.headers.get("host"));
  if (brand.lockedOrgSlug) {
    return NextResponse.json(
      { error: "Creating a new organization isn't available on this app." },
      { status: 403 }
    );
  }

  const rl = await checkRateLimit(`org-signup:${getClientIp(request)}`, SIGNUP_RATE_LIMIT);
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

  const { orgName, orgSlug, industry, fullName, email, password } = parsed.data;

  // Check slug uniqueness
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: { fieldErrors: { orgSlug: ["This slug is already taken"] } } },
      { status: 409 }
    );
  }

  const supabase = createAdminClient();

  // 1. Create the Supabase auth user FIRST (the only step we can't put in a DB
  //    transaction). If it fails we haven't touched the DB at all.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName },
    app_metadata: {
      role: "org_admin",
      organization_id: "__pending__",
      branch_id: null,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const authUserId = authData.user.id;

  // 2. Create org + branch + employee in a single transaction. If any step
  //    fails, nothing is persisted and we delete the orphan auth user.
  let orgId: string;
  try {
    orgId = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: orgName, slug: orgSlug, industry })
        .returning();

      await tx.insert(branches).values({
        organizationId: org.id,
        name: "Main",
        slug: "main",
      });

      await tx.insert(employees).values({
        organizationId: org.id,
        authUserId,
        name: fullName,
        email,
        role: "org_admin",
      });

      const starterRoles = INDUSTRY_STARTER_JOB_ROLES[industry];
      if (starterRoles.length > 0) {
        await tx.insert(jobRoles).values(
          starterRoles.map((name) => ({ organizationId: org.id, name }))
        );
      }

      return org.id;
    });
  } catch (e) {
    // Roll back the orphan auth user so a retry can reuse the email.
    try {
      await supabase.auth.admin.deleteUser(authUserId);
    } catch (deleteErr) {
      logger.error("Failed to clean up orphan auth user after org-create rollback:", deleteErr);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create organization" },
      { status: 500 }
    );
  }

  // 3. Patch the real organization_id into the auth user's app_metadata.
  const { error: syncError } = await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      role: "org_admin",
      organization_id: orgId,
      branch_id: null,
    },
  });
  if (syncError) {
    logger.error("Failed to sync org id into auth metadata after creation:", syncError);
    // The DB row is correct; admin can repair metadata later. Don't roll back.
  }

  // 4. admin.createUser() does not send a confirmation email by itself —
  //    generate the confirmation link and send it ourselves via Resend
  //    (Supabase's built-in email sending is not used).
  //
  //    We link to our own /confirmed page with token_hash/type (verified via
  //    verifyOtp) rather than the raw action_link: action_link's redirect
  //    uses Supabase's implicit hash-token flow, but our browser client is
  //    hardcoded to flowType "pkce" (see @supabase/ssr createBrowserClient),
  //    which rejects those hash tokens — confirmation still succeeds
  //    server-side but the page always showed "Confirmation failed".
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${brand.appUrl}/confirmed` },
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    logger.error("Failed to generate signup confirmation link:", linkError);
  } else {
    const confirmUrl = `${brand.appUrl}/confirmed?token_hash=${linkData.properties.hashed_token}&type=signup`;
    await sendConfirmationEmail(email, confirmUrl, fullName, brand);
  }

  return NextResponse.json({ orgId, userId: authUserId }, { status: 201 });
}
