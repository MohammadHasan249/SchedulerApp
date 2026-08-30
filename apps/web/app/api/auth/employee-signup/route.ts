import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

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

  // Check if employee was invited (exists in employees table)
  const [employee] = await db
    .select({
      id: employees.id,
      organizationId: employees.organizationId,
      name: employees.name,
      role: employees.role,
      branchId: employees.branchId,
      authUserId: employees.authUserId,
    })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  if (!employee) {
    return NextResponse.json(
      { error: "You haven't been invited to join an organization. Contact your administrator." },
      { status: 403 }
    );
  }

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
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/confirmed` },
  });
  if (linkError || !linkData?.properties?.action_link) {
    logger.error("Failed to generate signup confirmation link:", linkError);
  } else {
    await sendConfirmationEmail(email, linkData.properties.action_link, employee.name);
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
