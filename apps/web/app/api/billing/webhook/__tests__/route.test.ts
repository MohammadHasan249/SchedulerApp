import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({
  db: { update: vi.fn(), select: vi.fn(), insert: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: vi.fn(),
}));

function req(rawBody: string, signature = "sig") {
  return new Request("http://test", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: rawBody,
  });
}

function mockStripe(constructEventImpl: (...args: unknown[]) => unknown) {
  const stripe = { webhooks: { constructEvent: vi.fn(constructEventImpl) } };
  (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue(stripe);
  return stripe;
}

describe("POST /api/billing/webhook", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("returns 503 when Stripe isn't configured", async () => {
    (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const res = await POST(req("{}"));
    expect(res.status).toBe(503);
  });

  it("returns 400 when the signature header is missing", async () => {
    mockStripe(() => ({}));
    const res = await POST(req("{}", ""));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockStripe(() => {
      throw new Error("bad signature");
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
  });

  it("activates the growth plan on a completed subscription checkout", async () => {
    mockStripe(() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          subscription: "sub_1",
          metadata: { organizationId: "org-1", type: "subscription", plan: "growth" },
        },
      },
    }));
    const updateSet = vi.fn().mockReturnValue(chain(undefined));
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });

    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "growth", stripeSubscriptionId: "sub_1" }));
  });

  it("grants credits on a completed one-time credit purchase, idempotently", async () => {
    mockStripe(() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_2",
          mode: "payment",
          payment_intent: "pi_1",
          metadata: { organizationId: "org-1", type: "credits", quantity: "250" },
        },
      },
    }));
    // Not already processed.
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain([]));
    const insertValues = vi.fn().mockReturnValue(chain(undefined));
    const updateSet = vi.fn().mockReturnValue(chain(undefined));
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
    };
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", type: "purchase", amount: 250, stripePaymentIntentId: "pi_1" })
    );
    // creditsBalance is set via an atomic SQL `+` expression (not a plain
    // number) so a concurrent webhook/usage-decrement can't clobber it.
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ creditsBalance: expect.anything() })
    );
  });

  it("skips a duplicate credit purchase webhook delivery", async () => {
    mockStripe(() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_2",
          mode: "payment",
          payment_intent: "pi_1",
          metadata: { organizationId: "org-1", type: "credits", quantity: "250" },
        },
      },
    }));
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain([{ id: "existing-tx" }]));

    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("skips a credit purchase with a missing or invalid quantity, without touching the db", async () => {
    mockStripe(() => ({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_3",
          mode: "payment",
          payment_intent: "pi_2",
          metadata: { organizationId: "org-1", type: "credits" },
        },
      },
    }));

    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("reverts the org to the starter plan when a subscription is deleted", async () => {
    mockStripe(() => ({
      type: "customer.subscription.deleted",
      data: {
        object: { id: "sub_1", status: "canceled", metadata: { organizationId: "org-1", plan: "growth" } },
      },
    }));
    const updateSet = vi.fn().mockReturnValue(chain(undefined));
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });

    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ plan: "starter", stripeSubscriptionId: null }));
  });
});
