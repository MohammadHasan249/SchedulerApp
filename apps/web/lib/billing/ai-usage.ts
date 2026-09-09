import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationBilling, creditTransactions } from "@scheduler/database/schema";
import { getMonthlyAllowance } from "./plan-limits";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export type AiUsageCheck =
  | { allowed: true }
  | { allowed: false; reason: "monthly_limit_and_no_credits" };

/**
 * Applies the same lazy period-rollover rule `recordAiUsage` enforces on
 * write, for read-only display (the billing settings page). Without this,
 * an org that hasn't made an AI request since its period rolled over would
 * see last period's `monthlyUsed` count until their next request finally
 * triggers the reset write below.
 */
export function getDisplayUsage(billing: { monthlyUsed: number; periodStart: Date }): {
  monthlyUsed: number;
} {
  const periodAge = Date.now() - billing.periodStart.getTime();
  return { monthlyUsed: periodAge >= ONE_MONTH_MS ? 0 : billing.monthlyUsed };
}

/**
 * Atomically records one AI assistant turn against an organization's monthly
 * allowance, falling back to purchased credits once the allowance is used up.
 *
 * Uses a per-org Postgres advisory lock (same pattern as `withPinLock` in
 * `lib/employees.ts`) rather than a bare conditional UPDATE, because this
 * path also needs to *create* the billing row on first use and *reset* the
 * monthly counter when the period has rolled over — both read-then-write
 * steps that must not interleave with a concurrent request for the same org.
 */
export async function recordAiUsage(organizationId: string): Promise<AiUsageCheck> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 1))`);

    let [billing] = await tx
      .select()
      .from(organizationBilling)
      .where(eq(organizationBilling.organizationId, organizationId))
      .limit(1);

    if (!billing) {
      [billing] = await tx
        .insert(organizationBilling)
        .values({ organizationId })
        .returning();
    }

    const periodAge = Date.now() - billing.periodStart.getTime();
    const rolledOver = periodAge >= ONE_MONTH_MS;
    const { monthlyUsed } = getDisplayUsage(billing);
    const periodStart = rolledOver ? new Date() : billing.periodStart;

    const allowance = getMonthlyAllowance(billing.plan);

    if (allowance === null || monthlyUsed < allowance) {
      await tx
        .update(organizationBilling)
        .set({ monthlyUsed: monthlyUsed + 1, periodStart, updatedAt: new Date() })
        .where(eq(organizationBilling.organizationId, organizationId));
      return { allowed: true };
    }

    if (billing.creditsBalance > 0) {
      await tx
        .update(organizationBilling)
        .set({
          creditsBalance: billing.creditsBalance - 1,
          monthlyUsed,
          periodStart,
          updatedAt: new Date(),
        })
        .where(eq(organizationBilling.organizationId, organizationId));
      await tx.insert(creditTransactions).values({
        organizationId,
        type: "usage",
        amount: -1,
      });
      return { allowed: true };
    }

    // Persist the period reset even on the rejected path, so a stale
    // `periodStart` doesn't force every subsequent request this month to
    // re-derive the same reset.
    if (rolledOver) {
      await tx
        .update(organizationBilling)
        .set({ monthlyUsed, periodStart, updatedAt: new Date() })
        .where(eq(organizationBilling.organizationId, organizationId));
    }

    return { allowed: false, reason: "monthly_limit_and_no_credits" };
  });
}
