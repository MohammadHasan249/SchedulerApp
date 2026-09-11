import { pgTable, uuid, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const organizationPlanEnum = pgEnum("organization_plan", ["free", "pro"]);
export type OrganizationPlan = (typeof organizationPlanEnum.enumValues)[number];

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "monthly_grant",
  "purchase",
  "usage",
  "refund",
]);

/**
 * One row per organization. `monthlyUsed` counts AI assistant turns consumed
 * in the current `periodStart`..+1 month window (reset lazily by the caller,
 * not by a cron — see `lib/billing/ai-usage.ts`). `creditsBalance` is
 * purchased top-up credits: never expires, only drawn down once the plan's
 * monthly allowance is exhausted.
 */
export const organizationBilling = pgTable("organization_billing", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  plan: organizationPlanEnum("plan").notNull().default("free"),
  creditsBalance: integer("credits_balance").notNull().default(0),
  monthlyUsed: integer("monthly_used").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Set when a low-balance notification has been sent for the current
  // shortage, so recordAiUsage doesn't re-notify on every subsequent
  // request. Cleared on period rollover and on any credit purchase/plan
  // change, so a fresh shortage later notifies again.
  lowBalanceNotifiedAt: timestamp("low_balance_notified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only ledger of every balance-affecting event. Not read on the hot
 * path today — it exists so usage disputes and Stripe webhook idempotency
 * (via `stripePaymentIntentId`) have an audit trail from day one, before any
 * money is flowing through this system.
 */
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: creditTransactionTypeEnum("type").notNull(),
    // Positive for grants/purchases/refunds, negative for usage.
    amount: integer("amount").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_transactions_org_idx").on(t.organizationId, t.createdAt)]
);

export type OrganizationBilling = typeof organizationBilling.$inferSelect;
export type NewOrganizationBilling = typeof organizationBilling.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
