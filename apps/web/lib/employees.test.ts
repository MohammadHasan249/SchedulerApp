import { describe, it, expect, vi, beforeEach } from "vitest";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { pinCollidesWithExisting, withPinLock } from "./employees";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), transaction: vi.fn() } }));

describe("withPinLock", () => {
  beforeEach(() => vi.resetAllMocks());

  it("acquires an advisory lock scoped to the org before running fn, inside the same transaction", async () => {
    const tx = { execute: vi.fn().mockResolvedValue(undefined) };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    const fn = vi.fn().mockResolvedValue("done");
    const result = await withPinLock("org-1", fn);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalledTimes(1);
    // fn must run inside the same tx the lock was taken on — a separate
    // connection wouldn't hold the lock and the whole point is moot.
    expect(fn).toHaveBeenCalledWith(tx);
    expect(result).toBe("done");
  });

  it("propagates fn's rejection (and rolls back via the transaction)", async () => {
    const tx = { execute: vi.fn().mockResolvedValue(undefined) };
    (db.transaction as any).mockImplementation(async (cb: any) => cb(tx));

    await expect(withPinLock("org-1", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });
});

describe("pinCollidesWithExisting", () => {
  beforeEach(() => vi.resetAllMocks());

  it("queries through the given executor instead of the default db", async () => {
    const executor = { select: vi.fn(() => chain([])) } as any;

    await pinCollidesWithExisting("1234", "emp-1", "org-1", "b1", executor);

    expect(executor.select).toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("defaults to the top-level db when no executor is given", async () => {
    (db.select as any).mockReturnValue(chain([]));

    await pinCollidesWithExisting("1234", "emp-1", "org-1", "b1");

    expect(db.select).toHaveBeenCalled();
  });

  it("detects a collision against a same-branch active employee's PIN", async () => {
    const hash = await bcryptjs.hash("1234", 4);
    const executor = {
      select: vi.fn(() => chain([{ pinHash: hash, branchId: "b1", role: "employee" }])),
    } as any;

    const result = await pinCollidesWithExisting("1234", "emp-2", "org-1", "b1", executor);

    expect(result).toBe(true);
  });

  it("ignores a matching PIN at a different branch (non-admin)", async () => {
    const hash = await bcryptjs.hash("1234", 4);
    const executor = {
      select: vi.fn(() => chain([{ pinHash: hash, branchId: "other-branch", role: "employee" }])),
    } as any;

    const result = await pinCollidesWithExisting("1234", "emp-2", "org-1", "b1", executor);

    expect(result).toBe(false);
  });
});
