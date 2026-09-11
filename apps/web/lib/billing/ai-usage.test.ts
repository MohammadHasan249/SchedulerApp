import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { recordAiUsage } from "./ai-usage";
import { notifyLowBalance } from "./notify-low-balance";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({
  db: { transaction: vi.fn() },
}));
vi.mock("./notify-low-balance", () => ({
  notifyLowBalance: vi.fn(),
}));

/** Builds a fake `tx` whose `select` resolves `billingRow` and whose
 * `insert`/`update` record what they were called with. */
function fakeTx(billingRow: Record<string, unknown> | undefined) {
  const updateSet = vi.fn().mockReturnValue(chain(undefined));
  const insertValues = vi.fn().mockReturnValue({ returning: () => Promise.resolve([billingRow]) });
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnValue(chain(billingRow ? [billingRow] : [])),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  };
  return { tx, updateSet, insertValues };
}

function billingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    organizationId: "org-1",
    plan: "starter",
    creditsBalance: 0,
    monthlyUsed: 0,
    periodStart: new Date(),
    ...overrides,
  };
}

describe("recordAiUsage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (tx: unknown) => unknown) => {
        const { tx } = fakeTx(undefined);
        return fn(tx);
      }
    );
  });

  it("creates a billing row and allows usage on first call for an org", async () => {
    const { tx } = fakeTx(undefined);
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );
    // First select returns nothing (no row yet); insert returns a fresh row.
    (tx.select as ReturnType<typeof vi.fn>).mockReturnValue(chain([]));
    (tx.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: () => Promise.resolve([billingRow()]) }),
    });

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: true });
    expect(tx.update).toHaveBeenCalled();
  });

  it("allows usage while under the monthly allowance", async () => {
    const { tx } = fakeTx(billingRow({ monthlyUsed: 10 }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: true });
  });

  it("draws down purchased credits once the monthly allowance is exhausted", async () => {
    const { tx } = fakeTx(billingRow({ monthlyUsed: 50, creditsBalance: 3 }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: true });
    expect(tx.insert).toHaveBeenCalled();
  });

  it("fires a low-balance notification once remaining usage crosses the threshold", async () => {
    // 3 credits remaining before this call, allowance already exhausted —
    // after drawing 1 down, 2 remain, under the LOW_BALANCE_THRESHOLD of 5.
    const { tx, updateSet } = fakeTx(billingRow({ monthlyUsed: 50, creditsBalance: 3, lowBalanceNotifiedAt: null }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: true });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ lowBalanceNotifiedAt: expect.any(Date) }));
    expect(notifyLowBalance).toHaveBeenCalledWith("org-1");
  });

  it("does not re-notify if a low-balance notification already fired this period", async () => {
    const { tx } = fakeTx(billingRow({ monthlyUsed: 50, creditsBalance: 3, lowBalanceNotifiedAt: new Date() }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    await recordAiUsage("org-1");
    expect(notifyLowBalance).not.toHaveBeenCalled();
  });

  it("does not notify when comfortably under the allowance", async () => {
    const { tx } = fakeTx(billingRow({ monthlyUsed: 10, creditsBalance: 0 }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    await recordAiUsage("org-1");
    expect(notifyLowBalance).not.toHaveBeenCalled();
  });

  it("blocks the request once both the allowance and credits are exhausted", async () => {
    const { tx } = fakeTx(billingRow({ monthlyUsed: 50, creditsBalance: 0 }));
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: false, reason: "monthly_limit_and_no_credits" });
  });

  it("resets the monthly counter once the period has rolled over", async () => {
    const staleRow = billingRow({
      monthlyUsed: 50,
      creditsBalance: 0,
      periodStart: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    const { tx, updateSet } = fakeTx(staleRow);
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(tx)
    );

    const result = await recordAiUsage("org-1");
    expect(result).toEqual({ allowed: true });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ monthlyUsed: 1 }));
  });
});
