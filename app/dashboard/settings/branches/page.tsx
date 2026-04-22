import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { branches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BranchesTable } from "@/components/branches/BranchesTable";

export default async function BranchesPage() {
  const user = await getUser();
  requireRole(user, "org_admin");

  const branchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Branch Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create and manage your organization's branches.
        </p>
      </div>
      <BranchesTable branches={branchRows} />
    </div>
  );
}
