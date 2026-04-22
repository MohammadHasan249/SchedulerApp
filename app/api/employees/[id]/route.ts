import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { employees } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).optional(),
  branchId: z.string().uuid().nullable().optional(),
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  const employee = await getEmployee(id, user.organizationId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && employee.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(employee);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  if (user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await getEmployee(id, user.organizationId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "branch_manager" && employee.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pin, ...rest } = parsed.data;
  const updates: Partial<typeof employees.$inferInsert> = { ...rest };

  if (pin) {
    updates.pinHash = await bcrypt.hash(pin, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(employee);
  }

  // Sync app_metadata if role or branchId changed
  if (rest.role || rest.branchId !== undefined) {
    const supabase = createAdminClient();
    if (employee.authUserId) {
      await supabase.auth.admin.updateUserById(employee.authUserId, {
        app_metadata: {
          role: rest.role ?? employee.role,
          organization_id: employee.organizationId,
          branch_id: rest.branchId !== undefined ? rest.branchId : employee.branchId,
        },
      });
    }
  }

  const [updated] = await db
    .update(employees)
    .set(updates)
    .where(eq(employees.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
}
