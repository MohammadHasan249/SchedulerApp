import { getUser } from "@/lib/auth/getUser";
import { requireRole } from "@/lib/auth/requireRole";
import { db } from "@/lib/db";
import { branches, schedulingRules } from "@scheduler/database/schema";
import { eq, inArray } from "drizzle-orm";
import { SchedulingRulesManager } from "@/components/scheduling-rules/SchedulingRulesManager";

export default async function SchedulingRulesPage() {
  const user = await getUser();
  requireRole(user, "org_admin", "branch_manager");

  const allBranchRows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  // Branch managers only manage rules for their own branch; org admins see all.
  const branchRows =
    user.role === "branch_manager"
      ? allBranchRows.filter((b) => b.id === user.branchId)
      : allBranchRows;

  const branchIds = branchRows.map((b) => b.id);
  const ruleRows =
    branchIds.length > 0
      ? await db.select().from(schedulingRules).where(inArray(schedulingRules.branchId, branchIds))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scheduling Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Free-text staffing preferences (e.g. &ldquo;always assign 2 Chefs on weekends&rdquo;, &ldquo;don&apos;t
          schedule Alex and Jordan together&rdquo;). The AI scheduling assistant reads these as best-effort guidance
          alongside its hard constraints (hours, availability, time off).
        </p>
      </div>
      <SchedulingRulesManager
        branches={branchRows.map((b) => ({ id: b.id, name: b.name }))}
        rules={ruleRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
