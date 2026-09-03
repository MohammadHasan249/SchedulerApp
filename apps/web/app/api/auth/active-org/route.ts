import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/getUser";
import { cookies } from "next/headers";

const schema = z.object({ organizationId: z.string().uuid() });

// Sets the active-org cookie for web sessions after validating the caller
// actually has an active membership there — used by the org picker when
// getApiUser/getUser reports more than one membership.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [membership] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.authUserId, user.id),
        eq(employees.organizationId, parsed.data.organizationId),
        eq(employees.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Not a member of that organization" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, parsed.data.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ success: true });
}
