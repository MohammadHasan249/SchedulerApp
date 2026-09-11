import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { getStripe } from "@/lib/billing/stripe";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({
  getApiUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {},
}));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: vi.fn(),
  STRIPE_STARTER_PRICE_ID: "price_starter",
  STRIPE_GROWTH_PRICE_ID: "price_growth",
  STRIPE_CREDIT_PRICE_ID: "price_credit",
}));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null, email: "a@b.com" };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1", email: "m@b.com" };

function req(body?: unknown) {
  return new Request("http://test", {
    method: "POST",
    headers: { host: "app.test" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function mockStripe(overrides: Partial<{ create: ReturnType<typeof vi.fn> }> = {}) {
  const create = overrides.create ?? vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session1" });
  const stripe = {
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_1" }) },
    checkout: { sessions: { create } },
  };
  (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue(stripe);
  return stripe;
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(manager);
    const res = await POST(req({ type: "subscription", plan: "growth" }));
    expect(res.status).toBe(403);
  });

  it("returns 503 when Stripe isn't configured", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const res = await POST(req({ type: "subscription", plan: "growth" }));
    expect(res.status).toBe(503);
  });

  it("rejects a malformed body", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockStripe();
    const res = await POST(req({ type: "bogus" }));
    expect(res.status).toBe(400);
  });

  it("rejects a credit quantity below the minimum", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockStripe();
    const res = await POST(req({ type: "credits", quantity: 1 }));
    expect(res.status).toBe(400);
  });

  it("rejects a credit quantity above the maximum", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockStripe();
    const res = await POST(req({ type: "credits", quantity: 1_000_000 }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-integer credit quantity", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockStripe();
    const res = await POST(req({ type: "credits", quantity: 50.5 }));
    expect(res.status).toBe(400);
  });

  it("creates a Stripe customer on first checkout and returns the session url", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    const stripe = mockStripe();
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(chain([])); // getOrCreateBilling: no existing row
    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([{ organizationId: "org-1", plan: "starter", creditsBalance: 0, monthlyUsed: 0, stripeCustomerId: null }]),
        }),
      }),
    });
    // The locked customer-creation block runs inside db.transaction.
    const txUpdateSet = vi.fn().mockReturnValue(chain(undefined));
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn()
        .mockReturnValueOnce(chain([{ stripeCustomerId: null }])) // re-check inside the lock
        .mockReturnValueOnce(chain([{ name: "Acme" }])), // organizations lookup for customer name
      update: vi.fn().mockReturnValue({ set: txUpdateSet }),
    };
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const res = await POST(req({ type: "subscription", plan: "growth" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/session1" });
    expect(stripe.customers.create).toHaveBeenCalled();
    expect(txUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ stripeCustomerId: "cus_1" }));
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription", customer: "cus_1" })
    );
  });

  it("reuses an existing Stripe customer id without creating a new one, using the requested quantity", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    const stripe = mockStripe();
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      chain([{ organizationId: "org-1", plan: "starter", creditsBalance: 0, monthlyUsed: 0, stripeCustomerId: "cus_existing" }])
    );

    const res = await POST(req({ type: "credits", quantity: 250 }));
    expect(res.status).toBe(200);
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer: "cus_existing",
        line_items: [{ price: "price_credit", quantity: 250 }],
        metadata: expect.objectContaining({ type: "credits", quantity: "250" }),
      })
    );
  });
});
