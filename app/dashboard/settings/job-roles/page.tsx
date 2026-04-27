import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { jobRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { JobRolesList } from "@/components/job-roles/JobRolesList";

export default async function JobRolesPage() {
  const user = await getUser();
  requireRole(user, "org_admin");

  const roles = await db
    .select()
    .from(jobRoles)
    .where(eq(jobRoles.organizationId, user.organizationId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Job Roles</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create and manage job roles for your organization.
        </p>
      </div>
      <JobRolesList roles={roles} />
    </div>
  );
}
