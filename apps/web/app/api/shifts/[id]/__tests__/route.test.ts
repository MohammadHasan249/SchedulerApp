import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown) {
  return new Request("http://test", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/shifts/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await PATCH(req("PATCH", { isPublished: true }), params("s1"));
    expect(res.status).toBe(403);
  });

  it("locks a past shift against edits", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date("2020-01-01T00:00:00Z") }, branch: { id: "b1" } }])
    );
    const res = await PATCH(req("PATCH", { isPublished: true }), params("s1"));
    expect(res.status).toBe(409);
  });

  it("updates a future shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1" } }])
    );
    (db.update as any).mockReturnValue(chain([{ id: "s1", isPublished: true }]));
    const res = await PATCH(req("PATCH", { isPublished: true }), params("s1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/shifts/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("locks a past shift against deletion", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date("2020-01-01T00:00:00Z") }, branch: { id: "b1" } }])
    );
    const res = await DELETE(req("DELETE"), params("s1"));
    expect(res.status).toBe(409);
  });

  it("deletes a future shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1" } }])
    );
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req("DELETE"), params("s1"));
    expect(res.status).toBe(204);
  });
});
