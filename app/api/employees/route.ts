import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { employees } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq, and } from "drizzle-orm";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).default("employee"),
  branchId: z.string().uuid().nullable().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).default(40),
});

export async function GET() {
  const user = await getUser();

  const conditions = [eq(employees.organizationId, user.organizationId)];

  if (user.role === "branch_manager" && user.branchId) {
    conditions.push(eq(employees.branchId, user.branchId));
  }

  const rows = await db
    .select()
    .from(employees)
    .where(and(...conditions));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getUser();

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, role, branchId, maxHoursPerWeek } = parsed.data;

  if (user.role === "branch_manager" && role !== "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // branch_manager can only invite to their own branch
  const targetBranchId =
    user.role === "branch_manager" ? user.branchId : (branchId ?? null);

  const supabase = createAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: {
      role,
      organization_id: user.organizationId,
      branch_id: targetBranchId,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const [employee] = await db
    .insert(employees)
    .values({
      organizationId: user.organizationId,
      branchId: targetBranchId,
      authUserId: authData.user.id,
      name,
      email,
      role,
      maxHoursPerWeek,
    })
    .returning();

  return NextResponse.json(employee, { status: 201 });
}
