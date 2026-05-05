import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password } = parsed.data;

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
    email_confirm: true,
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

  return NextResponse.json({ success: true }, { status: 201 });
}
