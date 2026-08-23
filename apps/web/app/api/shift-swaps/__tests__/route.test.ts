import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { createNotification } from "@/lib/notifications";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn(), ApiAuthError: class ApiAuthError extends Error {} }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/shift-swaps", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns an empty list when the employee has no profile row", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("scopes an employee's view to swaps where they're requester or cover", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const rows = [{ id: "s1" }];
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/shift-swaps", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the caller has no employee profile", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(req({ shiftId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(404);
  });

  it("409s when the requester isn't assigned to the shift", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(
        chain([{ shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1" } }])
      )
      .mockReturnValueOnce(chain([]));
    const res = await POST(req({ shiftId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(409);
  });

  it("rejects nominating yourself as cover", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(
        chain([{ shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1" } }])
      )
      .mockReturnValueOnce(chain([{ id: "assignment-1" }]));
    const res = await POST(req({ shiftId: "550e8400-e29b-41d4-a716-446655440000", coverId: "emp-1" }));
    expect(res.status).toBe(400);
  });

  it("creates the swap request and notifies the nominated cover", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1", name: "Alice" }]))
      .mockReturnValueOnce(
        chain([{ shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1" } }])
      )
      .mockReturnValueOnce(chain([{ id: "assignment-1" }]))
      .mockReturnValueOnce(chain([{ id: "660e8400-e29b-41d4-a716-446655440000", branchId: "b1" }]));
    (db.insert as any).mockReturnValue(chain([{ id: "swap-1" }]));

    const res = await POST(
      req({ shiftId: "550e8400-e29b-41d4-a716-446655440000", coverId: "660e8400-e29b-41d4-a716-446655440000" })
    );
    expect(res.status).toBe(201);
    expect(createNotification).toHaveBeenCalled();
  });
});
