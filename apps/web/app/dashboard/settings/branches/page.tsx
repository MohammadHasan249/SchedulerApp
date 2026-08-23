import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { branches } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
import { BranchesTable } from "@/components/branches/BranchesTable";

export default async function BranchesPage() {
  const user = await getUser();
  requireRole(user, "org_admin", "branch_manager");

  const allBranchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  // Branch managers only manage their own branch; org admins see all.
  const branchRows =
    user.role === "branch_manager"
      ? allBranchRows.filter((b) => b.id === user.branchId)
      : allBranchRows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Branch Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user.role === "org_admin"
            ? "Create and manage your organization's branches."
            : "Manage your branch's settings."}
        </p>
      </div>
      <BranchesTable branches={branchRows} canCreateOrDelete={user.role === "org_admin"} />
    </div>
  );
}
