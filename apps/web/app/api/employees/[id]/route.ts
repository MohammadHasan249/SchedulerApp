import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { employees, branches, jobRoles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).optional(),
  branchId: z.string().uuid().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).optional(),
  isActive: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

async function getEmployee(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export const GET = withAuth(async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const employee = await getEmployee(id, user.organizationId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || employee.branchId !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(employee);
});

export const PATCH = withAuth(async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await getEmployee(id, user.organizationId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && (!user.branchId || employee.branchId !== user.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pin, ...rest } = parsed.data;

  // Only org_admin can change roles, and only org_admin can promote to org_admin
  if (rest.role !== undefined) {
    if (user.role !== "org_admin") {
      return NextResponse.json({ error: "Forbidden: only org_admin can change roles" }, { status: 403 });
    }
  }

  // Branch managers cannot move employees to a different branch
  if (rest.branchId !== undefined && user.role === "branch_manager") {
    if (rest.branchId !== user.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Verify branchId belongs to this organization
  if (rest.branchId) {
    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, rest.branchId), eq(branches.organizationId, user.organizationId)))
      .limit(1);
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }
  }

  // Verify jobRoleId belongs to this organization
  if (rest.jobRoleId) {
    const [jr] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(and(eq(jobRoles.id, rest.jobRoleId), eq(jobRoles.organizationId, user.organizationId)))
      .limit(1);
    if (!jr) {
      return NextResponse.json({ error: "Job role not found" }, { status: 404 });
    }
  }

  const updates: Partial<typeof employees.$inferInsert> = { ...rest };

  if (pin) {
    updates.pinHash = await bcrypt.hash(pin, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(employee);
  }

  // Sync app_metadata if role or branchId changed
  if ((rest.role || rest.branchId !== undefined) && employee.authUserId) {
    const supabase = createAdminClient();
    const syncResult = await supabase.auth.admin.updateUserById(employee.authUserId, {
      app_metadata: {
        role: rest.role ?? employee.role,
        organization_id: employee.organizationId,
        branch_id: rest.branchId !== undefined ? rest.branchId : employee.branchId,
      },
    });
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error.message }, { status: 500 });
    }
  }

  const [updated] = await db
    .update(employees)
    .set(updates)
    .where(eq(employees.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withAuth(async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await getEmployee(id, user.organizationId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deactivate rather than hard-delete
  const [updated] = await db
    .update(employees)
    .set({ isActive: false })
    .where(eq(employees.id, id))
    .returning();

  return NextResponse.json(updated);
});
