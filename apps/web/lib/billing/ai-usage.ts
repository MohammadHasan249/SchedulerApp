import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationBilling, creditTransactions } from "@scheduler/database/schema";
import { getMonthlyAllowance, LOW_BALANCE_THRESHOLD } from "./plan-limits";
import { notifyLowBalance } from "./notify-low-balance";

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
  // Set inside the transaction below (which must stay a quick DB round-trip,
  // not block on an outbound push-notification call) and acted on after it
  // commits.
  let shouldNotifyLowBalance = false;

  const result = await db.transaction(async (tx) => {
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
    // A rollover starts a fresh shortage window — allow a new low-balance
    // notification even if one already fired last period.
    const lowBalanceNotifiedAt = rolledOver ? null : billing.lowBalanceNotifiedAt;

    const allowance = getMonthlyAllowance(billing.plan);

    // Decides whether this update should also record the low-balance
    // notification timestamp, and mirrors that decision into the outer
    // `shouldNotifyLowBalance` so the actual notification (a network call)
    // happens after the transaction commits.
    function checkLowBalance(remaining: number | null): Date | null {
      if (remaining !== null && remaining <= LOW_BALANCE_THRESHOLD && !lowBalanceNotifiedAt) {
        shouldNotifyLowBalance = true;
        return new Date();
      }
      return lowBalanceNotifiedAt;
    }

    if (allowance === null || monthlyUsed < allowance) {
      const remaining = allowance === null ? null : allowance - (monthlyUsed + 1) + billing.creditsBalance;
      await tx
        .update(organizationBilling)
        .set({
          monthlyUsed: monthlyUsed + 1,
          periodStart,
          lowBalanceNotifiedAt: checkLowBalance(remaining),
          updatedAt: new Date(),
        })
        .where(eq(organizationBilling.organizationId, organizationId));
      return { allowed: true } as const;
    }

    if (billing.creditsBalance > 0) {
      const remaining = billing.creditsBalance - 1;
      await tx
        .update(organizationBilling)
        .set({
          creditsBalance: remaining,
          monthlyUsed,
          periodStart,
          lowBalanceNotifiedAt: checkLowBalance(remaining),
          updatedAt: new Date(),
        })
        .where(eq(organizationBilling.organizationId, organizationId));
      await tx.insert(creditTransactions).values({
        organizationId,
        type: "usage",
        amount: -1,
      });
      return { allowed: true } as const;
    }

    // Persist the period reset even on the rejected path, so a stale
    // `periodStart` doesn't force every subsequent request this month to
    // re-derive the same reset.
    if (rolledOver) {
      await tx
        .update(organizationBilling)
        .set({ monthlyUsed, periodStart, lowBalanceNotifiedAt, updatedAt: new Date() })
        .where(eq(organizationBilling.organizationId, organizationId));
    }

    return { allowed: false, reason: "monthly_limit_and_no_credits" } as const;
  });

  if (shouldNotifyLowBalance) {
    await notifyLowBalance(organizationId);
  }

  return result;
}
