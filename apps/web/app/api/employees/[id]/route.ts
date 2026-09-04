import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { employees, branches, jobRoles, shifts, shiftAssignments, permissionProfiles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pinCollidesWithExisting, isLastActiveOrgAdmin, unbanAuthUser, withPinLock } from "@/lib/employees";
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
  pin: z.string().regex(/^\d{4}$/).optional(),
});

// Excludes pinHash — a leaked bcrypt hash of a 4-digit PIN is crackable
// offline almost instantly, so it must never reach the client.
const EMPLOYEE_COLUMNS = {
  id: employees.id,
  organizationId: employees.organizationId,
  branchId: employees.branchId,
  authUserId: employees.authUserId,
  name: employees.name,
  email: employees.email,
  role: employees.role,
  jobRoleId: employees.jobRoleId,
  maxHoursPerWeek: employees.maxHoursPerWeek,
  isActive: employees.isActive,
  availabilitySchedule: employees.availabilitySchedule,
  permissionProfileId: employees.permissionProfileId,
} as const;

async function getEmployee(id: string, organizationId: string) {
  const [row] = await db
    .select(EMPLOYEE_COLUMNS)
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

  // Refuse to leave the org with zero admins: demoting or deactivating the
  // last org_admin would lock everyone out of admin-only settings.
  if (
    employee.role === "org_admin" &&
    ((rest.role !== undefined && rest.role !== "org_admin") || rest.isActive === false)
  ) {
    if (await isLastActiveOrgAdmin(user.organizationId, employee.id)) {
      return NextResponse.json(
        { error: "Cannot remove the organization's last admin. Promote another admin first." },
        { status: 409 }
      );
    }
  }

  // Branch managers cannot move employees to a different branch
  if (rest.branchId !== undefined && user.role === "branch_manager") {
    if (rest.branchId !== user.branchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Branch managers and employees are scoped to one branch throughout the
  // app — only an org admin can be branch-less (they oversee everything).
  const effectiveRole = rest.role ?? employee.role;
  const effectiveBranchId = rest.branchId !== undefined ? rest.branchId : employee.branchId;
  if (effectiveRole !== "org_admin" && !effectiveBranchId) {
    return NextResponse.json({ error: "branchId is required for this role" }, { status: 400 });
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

  if (Object.keys(updates).length === 0 && !pin) {
    return NextResponse.json(employee);
  }

  // Sentinel thrown inside the transaction below to distinguish "PIN
  // collision" (409, generic message) from other transaction failures (500).
  class PinCollisionError extends Error {}

  // Run DB update + auth metadata sync in a single transaction. If the metadata
  // sync fails we throw inside the tx and Postgres rolls back ALL field changes
  // — name/jobRoleId/maxHoursPerWeek/pin too, not just role/branch (the old
  // hand-rolled rollback only restored role+branchId, leaving the others
  // committed → inconsistent state). The whole thing also runs under
  // withPinLock's advisory lock when a PIN is being set, so the collision
  // check below can't race a concurrent PIN write for this org (see
  // lib/employees.ts).
  let updated;
  try {
    const runUpdate = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
      if (pin) {
        const targetBranch = rest.branchId !== undefined ? rest.branchId : employee.branchId;
        const collides = await pinCollidesWithExisting(pin, employee.id, employee.organizationId, targetBranch, tx);
        if (collides) throw new PinCollisionError();
        updates.pinHash = await bcrypt.hash(pin, 10);
      }

      const [row] = await tx
        .update(employees)
        .set(updates)
        .where(and(eq(employees.id, id), eq(employees.organizationId, user.organizationId)))
        .returning(EMPLOYEE_COLUMNS);

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
    };

    updated = pin
      ? await withPinLock(employee.organizationId, runUpdate)
      : await db.transaction(runUpdate);
  } catch (e) {
    if (e instanceof PinCollisionError) {
      // Deliberately generic — confirming "someone else already has this
      // PIN" would let a caller enumerate which PINs are live at the branch.
      return NextResponse.json(
        { error: "That PIN can't be used. Try a different one." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update employee" },
      { status: 500 }
    );
  }

  // Re-enable the auth user when an employee is reactivated.
  if (rest.isActive === true && !employee.isActive && employee.authUserId) {
    await unbanAuthUser(employee.authUserId);
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

  if (employee.role === "org_admin" && (await isLastActiveOrgAdmin(user.organizationId, employee.id))) {
    return NextResponse.json(
      { error: "Cannot remove the organization's last admin. Promote another admin first." },
      { status: 409 }
    );
  }

  // Deactivate rather than hard-delete, ban the Supabase auth user, AND
  // unassign them from any future shifts. Skipping the last step left
  // schedule grids showing inactive employees and double-counted hours in
  // reports until someone manually unassigned every shift.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(employees)
      .set({ isActive: false })
      .where(and(eq(employees.id, id), eq(employees.organizationId, user.organizationId)))
      .returning(EMPLOYEE_COLUMNS);

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
