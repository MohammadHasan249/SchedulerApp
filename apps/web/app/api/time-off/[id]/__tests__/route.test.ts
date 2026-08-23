import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { createNotification } from "@/lib/notifications";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), transaction: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown) {
  return new Request("http://test", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/time-off/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from approving/denying", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await PATCH(req("PATCH", { status: "approved" }), params("req-1"));
    expect(res.status).toBe(403);
  });

  it("404s when the request isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req("PATCH", { status: "approved" }), params("req-1"));
    expect(res.status).toBe(404);
  });

  it("approves and unassigns conflicting shifts, then notifies the employee", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ req: { id: "req-1" }, emp: { id: "emp-1", branchId: "b1" } }])
    );
    (db.transaction as any).mockImplementation(async (cb: any) =>
      cb({
        update: () => chain([{ id: "req-1", employeeId: "emp-1", startDate: "2024-01-01", endDate: "2024-01-03", status: "approved" }]),
        select: () => chain([{ id: "assignment-1" }]),
        delete: () => chain([]),
      })
    );
    const res = await PATCH(req("PATCH", { status: "approved" }), params("req-1"));
    expect(res.status).toBe(200);
    expect(createNotification).toHaveBeenCalled();
  });

  it("denies without touching assignments", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ req: { id: "req-1" }, emp: { id: "emp-1", branchId: "b1" } }])
    );
    (db.transaction as any).mockImplementation(async (cb: any) =>
      cb({ update: () => chain([{ id: "req-1", employeeId: "emp-1", startDate: "2024-01-01", endDate: "2024-01-03", status: "denied" }]) })
    );
    const res = await PATCH(req("PATCH", { status: "denied" }), params("req-1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/time-off/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids managers/admins from cancelling (employee-only action)", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await DELETE(req("DELETE"), params("req-1"));
    expect(res.status).toBe(403);
  });

  it("404s when the caller has no employee profile", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await DELETE(req("DELETE"), params("req-1"));
    expect(res.status).toBe(404);
  });

  it("rejects cancelling a non-pending request", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ id: "req-1", status: "approved" }]));
    const res = await DELETE(req("DELETE"), params("req-1"));
    expect(res.status).toBe(409);
  });

  it("cancels a pending request", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ id: "req-1", status: "pending" }]));
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req("DELETE"), params("req-1"));
    expect(res.status).toBe(204);
  });
});
