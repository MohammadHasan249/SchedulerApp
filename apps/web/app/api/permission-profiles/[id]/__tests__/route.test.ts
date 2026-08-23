import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain, rejectingChain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { update: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body?: unknown) {
  return new Request("http://test", { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/permission-profiles/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await PATCH(req({ name: "x" }), params("p1"));
    expect(res.status).toBe(403);
  });

  it("rejects an empty update", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PATCH(req({}), params("p1"));
    expect(res.status).toBe(400);
  });

  it("404s when the profile doesn't belong to the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.update as any).mockReturnValue(chain([]));
    const res = await PATCH(req({ name: "New name" }), params("p1"));
    expect(res.status).toBe(404);
  });

  it("returns 409 on a duplicate name", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.update as any).mockReturnValue(rejectingChain(new Error("duplicate key value")));
    const res = await PATCH(req({ name: "Taken" }), params("p1"));
    expect(res.status).toBe(409);
  });

  it("updates the profile", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const updated = { id: "p1", name: "New name", permissions: [] };
    (db.update as any).mockReturnValue(chain([updated]));
    const res = await PATCH(req({ name: "New name" }), params("p1"));
    expect(await res.json()).toEqual(updated);
  });
});

describe("DELETE /api/permission-profiles/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await DELETE(req(), params("p1"));
    expect(res.status).toBe(403);
  });

  it("404s when nothing was deleted", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req(), params("p1"));
    expect(res.status).toBe(404);
  });

  it("returns 204 on successful delete", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.delete as any).mockReturnValue(chain([{ id: "p1" }]));
    const res = await DELETE(req(), params("p1"));
    expect(res.status).toBe(204);
  });
});
