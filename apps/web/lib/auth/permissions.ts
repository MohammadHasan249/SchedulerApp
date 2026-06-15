import { db } from "@/lib/db";
import { employees, permissionProfiles } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";
import { PERMISSION_KEYS, type PermissionKey } from "@scheduler/types";
import type { AppUser } from "./getUser";

const ALL = new Set<PermissionKey>(PERMISSION_KEYS);

function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && (PERMISSION_KEYS as readonly string[]).includes(value);
}

/**
 * Pure authorization rule (no I/O — unit tested). org_admins implicitly hold
 * every permission; everyone else holds exactly what their assigned profile
 * grants. Unknown/stale keys in a profile are ignored.
 */
export function resolvePermissions(
  role: AppUser["role"],
  profilePermissions: readonly string[] | null | undefined
): Set<PermissionKey> {
  if (role === "org_admin") return new Set(ALL);
  return new Set((profilePermissions ?? []).filter(isPermissionKey));
}

/** Loads the caller's effective permissions, resolving their assigned profile. */
export async function getEmployeePermissions(user: AppUser): Promise<Set<PermissionKey>> {
  if (user.role === "org_admin") return new Set(ALL);

  const [row] = await db
    .select({ permissions: permissionProfiles.permissions })
    .from(employees)
    .leftJoin(permissionProfiles, eq(employees.permissionProfileId, permissionProfiles.id))
    .where(
      and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId))
    )
    .limit(1);

  return resolvePermissions(user.role, row?.permissions ?? []);
}

export async function userHasPermission(user: AppUser, key: PermissionKey): Promise<boolean> {
  if (user.role === "org_admin") return true;
  return (await getEmployeePermissions(user)).has(key);
}
