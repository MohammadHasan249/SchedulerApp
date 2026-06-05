import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { organizations, employees, branches } from "@scheduler/database/schema";
import { slugify } from "@/lib/utils/slugify";
import { eq } from "drizzle-orm";

const schema = z.object({
  orgName: z.string().min(2),
  orgSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgName, orgSlug, fullName, email, password } = parsed.data;

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
    email_confirm: true,
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
        .values({ name: orgName, slug: orgSlug })
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

      return org.id;
    });
  } catch (e) {
    // Roll back the orphan auth user so a retry can reuse the email.
    try {
      await supabase.auth.admin.deleteUser(authUserId);
    } catch (deleteErr) {
      console.error("Failed to clean up orphan auth user after org-create rollback:", deleteErr);
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
    console.error("Failed to sync org id into auth metadata after creation:", syncError);
    // The DB row is correct; admin can repair metadata later. Don't roll back.
  }

  return NextResponse.json({ orgId, userId: authUserId }, { status: 201 });
}
