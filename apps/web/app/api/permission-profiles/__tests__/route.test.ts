import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain, rejectingChain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/permission-profiles", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("lists profiles for the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const rows = [{ id: "p1", name: "Managers", permissions: ["salaries:view"] }];
    (db.select as any).mockReturnValue(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/permission-profiles", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(req({ name: "x" }));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid payload", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(req({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("dedupes permission keys and creates the profile", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const created = { id: "p1", name: "Managers", permissions: ["salaries:view"] };
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(req({ name: "Managers", permissions: ["salaries:view", "salaries:view"] }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });

  it("returns 409 on a duplicate name within the org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.insert as any).mockReturnValue(rejectingChain(new Error("duplicate key value")));
    const res = await POST(req({ name: "Managers" }));
    expect(res.status).toBe(409);
  });
});
