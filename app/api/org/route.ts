import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { organizations, employees, branches } from "@/db/schema";
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
  const body = await request.json();
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

  // Create org
  const [org] = await db
    .insert(organizations)
    .values({ name: orgName, slug: orgSlug })
    .returning();

  // Create default "Main" branch
  await db.insert(branches).values({
    organizationId: org.id,
    name: "Main",
    slug: "main",
  });

  // Create auth user with app_metadata pre-set (triggers DB row creation)
  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: {
      role: "org_admin",
      organization_id: org.id,
      branch_id: null,
    },
  });

  if (authError) {
    await db.delete(organizations).where(eq(organizations.id, org.id));
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  await db.insert(employees).values({
    organizationId: org.id,
    authUserId: authData.user.id,
    name: fullName,
    email,
    role: "org_admin",
  });

  return NextResponse.json({ orgId: org.id, userId: authData.user.id }, { status: 201 });
}
