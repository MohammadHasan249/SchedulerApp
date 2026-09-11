import type { OrganizationPlan } from "@scheduler/database/schema";

/**
 * AI assistant turns included per organization per month, by plan. Pure
 * numbers, no code changes needed to retune — bump these once real AI
 * Gateway cost data comes in. `null` means unlimited.
 */
export const MONTHLY_AI_ALLOWANCE: Record<OrganizationPlan, number | null> = {
  starter: 50,
  growth: 500,
};

export function getMonthlyAllowance(plan: OrganizationPlan): number | null {
  return MONTHLY_AI_ALLOWANCE[plan];
}

/**
 * Bounds on a single custom-quantity credit purchase. Also pure numbers to
 * retune — the Stripe price itself is per-credit (see
 * lib/billing/stripe.ts), so the org can buy any quantity in this range.
 */
export const MIN_CREDIT_PURCHASE = 10;
export const MAX_CREDIT_PURCHASE = 10_000;

/**
 * Remaining AI turns (unused monthly allowance + purchased credits combined)
 * at or below which an org gets a one-time low-balance notification. Tune
 * freely — doesn't affect enforcement, only when the heads-up fires.
 */
export const LOW_BALANCE_THRESHOLD = 5;
