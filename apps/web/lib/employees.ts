import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";

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
