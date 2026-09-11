import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { safeJson } from "@/lib/utils/safe-json";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { db } from "@/lib/db";
import { organizationBilling, organizations } from "@scheduler/database/schema";
import {
  getStripe,
  STRIPE_STARTER_PRICE_ID,
  STRIPE_GROWTH_PRICE_ID,
  STRIPE_CREDIT_PRICE_ID,
} from "@/lib/billing/stripe";
import { getOrCreateBilling } from "@/lib/billing/get-or-create-billing";
import { MIN_CREDIT_PURCHASE, MAX_CREDIT_PURCHASE } from "@/lib/billing/plan-limits";
import { getBrandForHost } from "@/lib/brand";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscription"), plan: z.enum(["starter", "growth"]) }),
  z.object({
    type: z.literal("credits"),
    quantity: z.number().int().min(MIN_CREDIT_PURCHASE).max(MAX_CREDIT_PURCHASE),
  }),
]);

const SUBSCRIPTION_PRICE_ID: Record<"starter" | "growth", string | undefined> = {
  starter: STRIPE_STARTER_PRICE_ID,
  growth: STRIPE_GROWTH_PRICE_ID,
};

/**
 * Creates a Stripe Checkout Session and returns its URL for the client to
 * redirect to. Org-admin only — billing is not a branch_manager action.
 */
export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stripe = getStripe();
  if (!stripe) {
    logger.warn("Billing checkout rejected: STRIPE_SECRET_KEY not configured");
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let priceId: string | undefined;
  let mode: "subscription" | "payment";
  let quantity = 1;
  let metadata: Record<string, string>;

  if (parsed.data.type === "subscription") {
    priceId = SUBSCRIPTION_PRICE_ID[parsed.data.plan];
    mode = "subscription";
    metadata = { organizationId: user.organizationId, type: "subscription", plan: parsed.data.plan };
  } else {
    priceId = STRIPE_CREDIT_PRICE_ID;
    mode = "payment";
    quantity = parsed.data.quantity;
    // Checkout Sessions don't otherwise expose line-item quantity when the
    // webhook reads the completed session back — round-trip it through
    // metadata instead of a second Stripe API call to fetch line items.
    metadata = { organizationId: user.organizationId, type: "credits", quantity: String(quantity) };
  }

  if (!priceId) {
    logger.warn("Billing checkout rejected: price not configured", { type: parsed.data.type });
    return NextResponse.json({ error: "That plan isn't available yet." }, { status: 503 });
  }

  const billing = await getOrCreateBilling(user.organizationId);

  let stripeCustomerId = billing.stripeCustomerId;
  if (!stripeCustomerId) {
    // Advisory-locked (distinct salt from the ai-usage/webhook lock, which
    // guards a different critical section — see recordAiUsage) so two
    // concurrent first-checkout requests for the same org can't each create
    // and persist their own Stripe customer, orphaning one of them.
    stripeCustomerId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${user.organizationId}, 2))`);
      const [row] = await tx
        .select({ stripeCustomerId: organizationBilling.stripeCustomerId })
        .from(organizationBilling)
        .where(eq(organizationBilling.organizationId, user.organizationId))
        .limit(1);
      if (row?.stripeCustomerId) return row.stripeCustomerId;

      const [org] = await tx
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
      const customer = await stripe.customers.create({
        name: org?.name,
        email: user.email,
        metadata: { organizationId: user.organizationId },
      });
      await tx
        .update(organizationBilling)
        .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
        .where(eq(organizationBilling.organizationId, user.organizationId));
      return customer.id;
    });
  }

  const brand = getBrandForHost(request.headers.get("host"));
  const returnBase = `${brand.appUrl}/dashboard/settings/billing`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity }],
      client_reference_id: user.organizationId,
      metadata,
      // Session-level metadata doesn't carry onto the created Subscription
      // object, so subscription lifecycle events (renewal, cancellation)
      // wouldn't otherwise know which org they belong to.
      ...(mode === "subscription" ? { subscription_data: { metadata } } : {}),
      success_url: `${returnBase}?checkout=success`,
      cancel_url: `${returnBase}?checkout=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    logger.error("Failed to create Stripe checkout session:", e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
});
