import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationBilling, creditTransactions } from "@scheduler/database/schema";
import { getStripe } from "@/lib/billing/stripe";
import type Stripe from "stripe";

/**
 * Stripe webhook receiver. Unauthenticated by design (Stripe calls this, not
 * a logged-in user) — trust is established purely by verifying the signature
 * against STRIPE_WEBHOOK_SECRET below. Every credit grant is written through
 * the `credit_transactions` ledger with the Stripe event's payment_intent id
 * as a unique key, so a duplicate delivery (Stripe retries at-least-once)
 * can't double-grant credits.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    logger.warn("Stripe webhook rejected: billing not configured");
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    logger.warn("Stripe webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (e) {
    logger.error("Stripe webhook handler failed:", e, { eventType: event.type });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId ?? session.client_reference_id;
  if (!organizationId) {
    logger.error("Stripe checkout.session.completed missing organizationId metadata", {
      sessionId: session.id,
    });
    return;
  }

  if (session.mode === "subscription") {
    await db
      .update(organizationBilling)
      .set({
        plan: "pro",
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
        updatedAt: new Date(),
      })
      .where(eq(organizationBilling.organizationId, organizationId));
    return;
  }

  // One-time custom-quantity credit purchase.
  const quantity = Number(session.metadata?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    logger.error("Stripe checkout.session.completed: missing/invalid credit quantity", {
      quantity: session.metadata?.quantity,
      sessionId: session.id,
    });
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.id;

  // Idempotency: the unique constraint on stripePaymentIntentId makes a
  // duplicate webhook delivery a no-op insert failure rather than a double
  // grant — check-then-skip instead of catching the constraint error, since
  // drizzle-orm doesn't give a clean typed way to distinguish that error.
  const [existing] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (existing) return;

  // Same advisory-lock pattern as recordAiUsage (lib/billing/ai-usage.ts) —
  // without it, this read-then-write could race a concurrent AI-usage credit
  // decrement (or a second webhook delivery) and silently lose an update.
  // The atomic `+ quantity` SQL expression closes the race even further: no
  // read of the current balance is needed at all.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 1))`);
    await tx.insert(creditTransactions).values({
      organizationId,
      type: "purchase",
      amount: quantity,
      stripePaymentIntentId: paymentIntentId,
    });
    await tx
      .update(organizationBilling)
      .set({
        creditsBalance: sql`${organizationBilling.creditsBalance} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(organizationBilling.organizationId, organizationId));
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    logger.warn("Stripe subscription event missing organizationId metadata", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const active = subscription.status === "active" || subscription.status === "trialing";
  await db
    .update(organizationBilling)
    .set({
      plan: active ? "pro" : "free",
      stripeSubscriptionId: active ? subscription.id : null,
      updatedAt: new Date(),
    })
    .where(eq(organizationBilling.organizationId, organizationId));
}
