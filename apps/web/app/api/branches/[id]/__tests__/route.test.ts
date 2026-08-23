import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn(), ApiAuthError: class ApiAuthError extends Error {} }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body?: unknown) {
  return new Request("http://test", { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/branches/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees outright", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null });
    const res = await PATCH(req({ name: "x" }), params("b1"));
    expect(res.status).toBe(403);
  });

  it("forbids a branch_manager editing a branch other than their own", async () => {
    (getApiUser as any).mockResolvedValue(manager); // manager.branchId === "b1"
    const res = await PATCH(req({ name: "x" }), params("other-branch"));
    expect(res.status).toBe(403);
  });

  it("forbids a branch_manager with no branch assigned", async () => {
    (getApiUser as any).mockResolvedValue({ ...manager, branchId: null });
    const res = await PATCH(req({ name: "x" }), params("b1"));
    expect(res.status).toBe(403);
  });

  it("allows a branch_manager to edit their own branch", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([{ id: "b1", slug: "old-slug" }]));
    const updated = { id: "b1", name: "New Name" };
    (db.update as any).mockReturnValue(chain([updated]));
    const res = await PATCH(req({ name: "New Name" }), params("b1"));
    expect(res.status).toBe(200);
  });

  it("404s when the branch isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req({ name: "x" }), params("b1"));
    expect(res.status).toBe(404);
  });

  it("rejects a slug collision with another branch", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1", slug: "old-slug" }]))
      .mockReturnValueOnce(chain([{ id: "b2" }]));
    const res = await PATCH(req({ slug: "taken-slug" }), params("b1"));
    expect(res.status).toBe(409);
  });

  it("updates the branch", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "b1", slug: "old-slug" }]));
    const updated = { id: "b1", name: "New Name" };
    (db.update as any).mockReturnValue(chain([updated]));
    const res = await PATCH(req({ name: "New Name" }), params("b1"));
    expect(await res.json()).toEqual(updated);
  });
});

describe("DELETE /api/branches/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await DELETE(req(), params("b1"));
    expect(res.status).toBe(403);
  });

  it("refuses to delete a branch with active employees still attached", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }])) // getBranch
      .mockReturnValueOnce(chain([{ id: "emp-1" }])); // stillAttached
    const res = await DELETE(req(), params("b1"));
    expect(res.status).toBe(409);
  });

  it("refuses to delete a branch with upcoming shifts", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }])) // getBranch
      .mockReturnValueOnce(chain([])) // no active employees
      .mockReturnValueOnce(chain([{ id: "shift-1" }])); // upcoming shift
    const res = await DELETE(req(), params("b1"));
    expect(res.status).toBe(409);
  });

  it("deletes a branch with no employees or upcoming shifts", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req(), params("b1"));
    expect(res.status).toBe(204);
  });
});
