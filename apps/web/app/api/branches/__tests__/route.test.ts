import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/branches", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists branches for the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const rows = [{ id: "b1", name: "Main" }];
    (db.select as any).mockReturnValue(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/branches", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins from creating a branch", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(req({ name: "New Branch" }));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid payload", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(req({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate slug within the org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "existing" }]));
    const res = await POST(req({ name: "Main", slug: "main" }));
    expect(res.status).toBe(409);
  });

  it("derives a slug from the name when none is given and creates the branch", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const created = { id: "b2", name: "Downtown", slug: "downtown" };
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(req({ name: "Downtown" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });
});
