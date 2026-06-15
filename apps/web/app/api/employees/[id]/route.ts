import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { employees, branches, jobRoles, shifts, shiftAssignments, permissionProfiles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pinCollidesWithExisting } from "@/lib/employees/pin";
import { eq, and, gte, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["org_admin", "branch_manager", "employee"]).optional(),
  branchId: z.string().uuid().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  maxHoursPerWeek: z.number().int().min(1).max(168).optional(),
  isActive: z.boolean().optional(),
  permissionProfileId: z.string().uuid().nullable().optional(),
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

  // Employees may only read their own record. 404 (not 403) so ids can't
  // be probed for existence.
  if (user.role === "employee" && employee.authUserId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
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

  // Assigning a permission profile grants capabilities (e.g. viewing salaries),
  // so it's org_admin-only and the profile must belong to this org.
  if (rest.permissionProfileId !== undefined) {
    if (user.role !== "org_admin") {
      return NextResponse.json(
        { error: "Forbidden: only org_admin can assign permission profiles" },
        { status: 403 }
      );
    }
    if (rest.permissionProfileId !== null) {
      const [profile] = await db
        .select({ id: permissionProfiles.id })
        .from(permissionProfiles)
        .where(
          and(
            eq(permissionProfiles.id, rest.permissionProfileId),
            eq(permissionProfiles.organizationId, user.organizationId)
          )
        )
        .limit(1);
      if (!profile) {
        return NextResponse.json({ error: "Permission profile not found" }, { status: 404 });
      }
    }
  }

  const updates: Partial<typeof employees.$inferInsert> = { ...rest };

  if (pin) {
    const targetBranch = rest.branchId !== undefined ? rest.branchId : employee.branchId;
    const collides = await pinCollidesWithExisting(pin, employee.id, employee.organizationId, targetBranch);
    if (collides) {
      return NextResponse.json(
        { error: "Another employee at this branch already uses that PIN. Pick a different one." },
        { status: 409 }
      );
    }
    updates.pinHash = await bcrypt.hash(pin, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(employee);
  }

  // Run DB update + auth metadata sync in a single transaction. If the metadata
  // sync fails we throw inside the tx and Postgres rolls back ALL field changes
  // — name/jobRoleId/maxHoursPerWeek/pin too, not just role/branch (the old
  // hand-rolled rollback only restored role+branchId, leaving the others
  // committed → inconsistent state).
  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(employees)
        .set(updates)
        .where(eq(employees.id, id))
        .returning();

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
          throw new Error(syncResult.error.message);
        }
      }

      return row;
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update employee" },
      { status: 500 }
    );
  }

  // Re-enable the auth user when an employee is reactivated.
  if (rest.isActive === true && !employee.isActive && employee.authUserId) {
    try {
      const supabase = createAdminClient();
      await supabase.auth.admin.updateUserById(employee.authUserId, {
        ban_duration: "none",
      });
    } catch (e) {
      logger.error("Failed to unban reactivated employee's auth user:", e);
    }
  }

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

  // Deactivate rather than hard-delete, ban the Supabase auth user, AND
  // unassign them from any future shifts. Skipping the last step left
  // schedule grids showing inactive employees and double-counted hours in
  // reports until someone manually unassigned every shift.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employees)
      .set({ isActive: false })
      .where(eq(employees.id, id))
      .returning();

    const futureShiftIds = (
      await tx
        .select({ id: shifts.id })
        .from(shifts)
        .innerJoin(shiftAssignments, eq(shiftAssignments.shiftId, shifts.id))
        .where(and(eq(shiftAssignments.employeeId, id), gte(shifts.startTime, new Date())))
    ).map((r) => r.id);

    if (futureShiftIds.length > 0) {
      await tx
        .delete(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.employeeId, id),
            inArray(shiftAssignments.shiftId, futureShiftIds)
          )
        );
    }

    return row;
  });

  if (employee.authUserId) {
    try {
      const supabase = createAdminClient();
      await supabase.auth.admin.updateUserById(employee.authUserId, {
        ban_duration: "876000h", // ~100 years
      });
    } catch (e) {
      logger.error("Failed to ban deactivated employee's auth user:", e);
    }
  }

  return NextResponse.json(updated);
});
