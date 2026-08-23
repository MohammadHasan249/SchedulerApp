import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body?: unknown) {
  return new Request("http://test", { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/job-roles/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await PATCH(req({ name: "x" }), params("jr1"));
    expect(res.status).toBe(403);
  });

  it("404s when the role isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req({ name: "x" }), params("jr1"));
    expect(res.status).toBe(404);
  });

  it("updates the role for a branch_manager", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([{ id: "jr1", name: "Cook" }]));
    const updated = { id: "jr1", name: "Head Cook" };
    (db.update as any).mockReturnValue(chain([updated]));
    const res = await PATCH(req({ name: "Head Cook" }), params("jr1"));
    expect(await res.json()).toEqual(updated);
  });
});

describe("DELETE /api/job-roles/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins (branch_manager cannot delete)", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await DELETE(req(), params("jr1"));
    expect(res.status).toBe(403);
  });

  it("404s when not found", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await DELETE(req(), params("jr1"));
    expect(res.status).toBe(404);
  });

  it("deletes the role", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "jr1" }]));
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req(), params("jr1"));
    expect(res.status).toBe(204);
  });
});
