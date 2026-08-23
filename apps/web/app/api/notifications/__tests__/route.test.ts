import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };

describe("GET /api/notifications", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns an empty list when the caller has no employee row", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns the caller's notifications scoped to their org", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const rows = [{ id: "n1", isRead: false }];
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});
