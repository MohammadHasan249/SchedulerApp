import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq, and, ne, isNotNull, sql } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/** Anything that can run drizzle queries: the top-level `db`, or a `tx` from `db.transaction`. */
type Queryable = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Returns true if any *other* active employee at the same branch — or any
 * org_admin in the same organization (admins can clock in at any branch) —
 * already has this PIN.
 *
 * PINs are bcrypt-hashed so collision detection is O(n): we compare the
 * candidate PIN against each relevant employee's stored hash.
 *
 * This is a read; it only becomes race-free when called with the `tx` from
 * `withPinLock` (see below) so no other PIN write for the org can interleave
 * between this check and the caller's subsequent write.
 */
export async function pinCollidesWithExisting(
  pin: string,
  employeeId: string,
  organizationId: string,
  branchId: string | null,
  executor: Queryable = db
): Promise<boolean> {
  const candidates = await executor
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
 * employee at the given branch (or any org_admin in the organization). Pass
 * the `tx` from `withPinLock` to make the generate-then-insert race-free.
 */
export async function generateUniquePin(
  organizationId: string,
  branchId: string | null,
  executor: Queryable = db
): Promise<string> {
  const placeholderId = "00000000-0000-0000-0000-000000000000";
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!(await pinCollidesWithExisting(pin, placeholderId, organizationId, branchId, executor))) {
      return pin;
    }
  }
  throw new Error("Could not generate a unique PIN");
}

/**
 * Runs `fn` inside a transaction holding a Postgres advisory lock scoped to
 * the organization. Without this, `pinCollidesWithExisting` (a SELECT) and
 * the caller's write are two separate round-trips: two concurrent PIN-set
 * requests for the same org can both read "no collision" before either
 * write commits, letting two employees end up with the same PIN. The lock
 * serializes every PIN read+write for an org so the second request's SELECT
 * always sees the first request's already-committed write.
 *
 * Callers must run every read and write involved in setting the PIN through
 * the `tx` passed to `fn` — using the top-level `db` inside `fn` would
 * bypass the lock's transaction and defeat the point.
 */
export async function withPinLock<T>(
  organizationId: string,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`);
    return fn(tx);
  });
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
