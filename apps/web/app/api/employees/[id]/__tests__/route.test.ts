import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { pinCollidesWithExisting, isLastActiveOrgAdmin, withPinLock } from "@/lib/employees";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
// withPinLock just runs its callback with the (mocked) db in place of a real
// tx — these tests don't exercise real transaction/locking semantics.
vi.mock("@/lib/employees", async () => {
  const { db } = await import("@/lib/db");
  return {
    pinCollidesWithExisting: vi.fn(),
    isLastActiveOrgAdmin: vi.fn().mockResolvedValue(false),
    withPinLock: vi.fn((_organizationId: string, fn: (tx: typeof db) => unknown) => fn(db)),
  };
});

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown) {
  return new Request("http://test", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/employees/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the target isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET(req("GET"), params("emp-1"));
    expect(res.status).toBe(404);
  });

  it("404s (not 403) when an employee requests someone else's record", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", authUserId: "someone-else", organizationId: "org-1" }]));
    const res = await GET(req("GET"), params("emp-1"));
    expect(res.status).toBe(404);
  });

  it("returns the employee record for an org admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const employee = { id: "emp-1", organizationId: "org-1", authUserId: "someone" };
    (db.select as any).mockReturnValue(chain([employee]));
    const res = await GET(req("GET"), params("emp-1"));
    expect(await res.json()).toEqual(employee);
  });
});

describe("PATCH /api/employees/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (isLastActiveOrgAdmin as any).mockResolvedValue(false);
    // resetAllMocks clears the passthrough implementation set in the factory
    // above too, so it needs to be re-established here each time.
    (withPinLock as any).mockImplementation((_organizationId: string, fn: (tx: typeof db) => unknown) => fn(db));
  });

  it("forbids employees from editing", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await PATCH(req("PATCH", { name: "x" }), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("forbids a branch_manager from changing roles", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", branchId: "b1", organizationId: "org-1" }]));
    const res = await PATCH(req("PATCH", { role: "branch_manager" }), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("rejects a PIN collision", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (pinCollidesWithExisting as any).mockResolvedValue(true);
    const res = await PATCH(req("PATCH", { pin: "1234" }), params("emp-1"));
    expect(res.status).toBe(409);
  });

  it("updates fields via a transaction", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1", authUserId: null }]));
    const updated = { id: "emp-1", name: "New Name" };
    (db.transaction as any).mockImplementation(async (cb: any) =>
      cb({ update: () => chain([updated]) })
    );
    const res = await PATCH(req("PATCH", { name: "New Name" }), params("emp-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(updated);
  });

  it("refuses to demote the organization's last active admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", role: "org_admin", organizationId: "org-1", branchId: null }])
    );
    (isLastActiveOrgAdmin as any).mockResolvedValue(true);
    const res = await PATCH(req("PATCH", { role: "employee" }), params("emp-1"));
    expect(res.status).toBe(409);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the organization's last active admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", role: "org_admin", organizationId: "org-1", branchId: null }])
    );
    (isLastActiveOrgAdmin as any).mockResolvedValue(true);
    const res = await PATCH(req("PATCH", { isActive: false }), params("emp-1"));
    expect(res.status).toBe(409);
  });

  it("allows demoting an admin when another active admin remains", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(
        chain([{ id: "emp-1", role: "org_admin", organizationId: "org-1", branchId: null, authUserId: null }])
      )
      .mockReturnValueOnce(chain([{ id: "11111111-1111-4111-8111-111111111111" }]));
    (isLastActiveOrgAdmin as any).mockResolvedValue(false);
    const updated = { id: "emp-1", role: "employee" };
    (db.transaction as any).mockImplementation(async (cb: any) => cb({ update: () => chain([updated]) }));
    const res = await PATCH(
      req("PATCH", { role: "employee", branchId: "11111111-1111-4111-8111-111111111111" }),
      params("emp-1")
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/employees/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (isLastActiveOrgAdmin as any).mockResolvedValue(false);
  });

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await DELETE(req("DELETE"), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("404s when not found", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await DELETE(req("DELETE"), params("emp-1"));
    expect(res.status).toBe(404);
  });

  it("refuses to delete the organization's last active admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", role: "org_admin", organizationId: "org-1", authUserId: "auth-1" }])
    );
    (isLastActiveOrgAdmin as any).mockResolvedValue(true);
    const res = await DELETE(req("DELETE"), params("emp-1"));
    expect(res.status).toBe(409);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("deactivates the employee and bans their auth user", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", role: "employee", organizationId: "org-1", authUserId: "auth-1" }]));
    const deactivated = { id: "emp-1", isActive: false };
    (db.transaction as any).mockImplementation(async (cb: any) =>
      cb({
        update: () => chain([deactivated]),
        select: () => chain([]),
        delete: () => chain([]),
      })
    );
    const supabase = { auth: { admin: { updateUserById: vi.fn().mockResolvedValue({}) } } };
    (createAdminClient as any).mockReturnValue(supabase);

    const res = await DELETE(req("DELETE"), params("emp-1"));
    expect(res.status).toBe(200);
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ ban_duration: expect.any(String) })
    );
  });
});
