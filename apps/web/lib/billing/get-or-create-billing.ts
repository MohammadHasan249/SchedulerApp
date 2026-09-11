import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationBilling, type OrganizationBilling } from "@scheduler/database/schema";

/** Returns the org's billing row, creating a default `plan: 'starter'` row on first access. */
export async function getOrCreateBilling(organizationId: string): Promise<OrganizationBilling> {
  const [existing] = await db
    .select()
    .from(organizationBilling)
    .where(eq(organizationBilling.organizationId, organizationId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(organizationBilling)
    .values({ organizationId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a create race against a concurrent request — re-read.
  const [row] = await db
    .select()
    .from(organizationBilling)
    .where(eq(organizationBilling.organizationId, organizationId))
    .limit(1);
  return row!;
}
