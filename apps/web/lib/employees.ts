import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Returns true if any *other* active employee at the same branch — or any
 * org_admin in the same organization (admins can clock in at any branch) —
 * already has this PIN.
 *
 * PINs are bcrypt-hashed so collision detection is O(n): we compare the
 * candidate PIN against each relevant employee's stored hash.
 */
export async function pinCollidesWithExisting(
  pin: string,
  employeeId: string,
  organizationId: string,
  branchId: string | null
): Promise<boolean> {
  const candidates = await db
    .select({ pinHash: employees.pinHash, branchId: employees.branchId, role: employees.role })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.isActive, true),
        ne(employees.id, employeeId),
        isNotNull(employees.pinHash)
      )
    );

  const relevant = candidates.filter(
    (c) => c.branchId === branchId || c.role === "org_admin"
  );

  for (const c of relevant) {
    if (await bcryptjs.compare(pin, c.pinHash!)) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a random 4-digit PIN that doesn't collide with any existing
 * employee at the given branch (or any org_admin in the organization).
 */
export async function generateUniquePin(
  organizationId: string,
  branchId: string | null
): Promise<string> {
  const placeholderId = "00000000-0000-0000-0000-000000000000";
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!(await pinCollidesWithExisting(pin, placeholderId, organizationId, branchId))) {
      return pin;
    }
  }
  throw new Error("Could not generate a unique PIN");
}

/**
 * Returns true if `employeeId` is currently the organization's only active
 * org_admin — i.e. demoting, deactivating, or deleting them would leave the
 * org with zero admins able to manage it.
 */
export async function isLastActiveOrgAdmin(
  organizationId: string,
  employeeId: string
): Promise<boolean> {
  const otherAdmins = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.role, "org_admin"),
        eq(employees.isActive, true),
        ne(employees.id, employeeId)
      )
    )
    .limit(1);
  return otherAdmins.length === 0;
}

/**
 * Lifts the ~100-year ban applied when an employee is deactivated (see
 * DELETE /api/employees/[id]). Used both when reactivating an existing
 * employee (PATCH isActive: true) and when re-inviting a previously
 * deactivated employee, which reactivates their row instead of erroring on
 * the per-org unique email constraint.
 */
export async function unbanAuthUser(authUserId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.auth.admin.updateUserById(authUserId, { ban_duration: "none" });
  } catch (e) {
    logger.error("Failed to unban reactivated employee's auth user:", e);
  }
}
