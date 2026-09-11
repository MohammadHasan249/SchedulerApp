import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazily-constructed Stripe client. Returns null when STRIPE_SECRET_KEY isn't
 * configured (e.g. local dev without Stripe set up) so callers can degrade
 * the same way the AI Gateway path does — a clear 503, not a crash.
 */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

/**
 * Product/price configuration, kept out of the route handlers so pricing can
 * change without touching checkout/webhook logic. Price IDs come from env
 * vars (set them once the corresponding Product/Price exist in the Stripe
 * dashboard) rather than being hardcoded, so switching between Stripe test
 * and live mode is just an env swap.
 */
export const STRIPE_STARTER_PRICE_ID = process.env.STRIPE_PRICE_ID_STARTER;
export const STRIPE_GROWTH_PRICE_ID = process.env.STRIPE_PRICE_ID_GROWTH;

// A single per-unit price (quantity = however many credits the org wants to
// buy), not a fixed pack — set this to a Stripe Price with billing scheme
// "per unit" so `quantity` on the Checkout line item controls the charge.
export const STRIPE_CREDIT_PRICE_ID = process.env.STRIPE_PRICE_ID_CREDIT;
