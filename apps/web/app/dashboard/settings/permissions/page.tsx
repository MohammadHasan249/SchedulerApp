import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { permissionProfiles, employees } from "@scheduler/database/schema";
import { eq, and, ne, asc } from "drizzle-orm";
import { PermissionsAdmin } from "@/components/permissions/PermissionsAdmin";
import type { PermissionProfile, PermissionKey } from "@scheduler/types";

export default async function PermissionsPage() {
  const user = await getUser();
  requireRole(user, "org_admin");

  const profileRows = await db
    .select()
    .from(permissionProfiles)
    .where(eq(permissionProfiles.organizationId, user.organizationId))
    .orderBy(asc(permissionProfiles.name));

  // Org admins implicitly have every permission, so they aren't assignable.
  const empRows = await db
    .select({
      id: employees.id,
      name: employees.name,
      email: employees.email,
      permissionProfileId: employees.permissionProfileId,
    })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, user.organizationId),
        eq(employees.isActive, true),
        ne(employees.role, "org_admin")
      )
    )
    .orderBy(asc(employees.name));

  const profiles: PermissionProfile[] = profileRows.map((p) => ({
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    permissions: (p.permissions as PermissionKey[]) ?? [],
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permissions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create permission profiles and assign them to managers and staff. Org admins always
          have every permission.
        </p>
      </div>
      <PermissionsAdmin initialProfiles={profiles} initialEmployees={empRows} />
    </div>
  );
}
