import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("POST /api/shifts/publish", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(req({ branchId: "550e8400-e29b-41d4-a716-446655440000", weekStart: "2024-01-01T00:00:00Z" }));
    expect(res.status).toBe(403);
  });

  it("404s when the branch isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(req({ branchId: "550e8400-e29b-41d4-a716-446655440000", weekStart: "2024-01-01T00:00:00Z" }));
    expect(res.status).toBe(404);
  });

  it("forbids a branch_manager publishing another branch", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([{ id: "other-branch" }]));
    const res = await POST(req({ branchId: "550e8400-e29b-41d4-a716-446655440000", weekStart: "2024-01-01T00:00:00Z" }));
    expect(res.status).toBe(403);
  });

  it("publishes the week's shifts", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "b1" }]));
    (db.update as any).mockReturnValue(chain([]));
    const res = await POST(req({ branchId: "550e8400-e29b-41d4-a716-446655440000", weekStart: "2024-01-01T00:00:00Z" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
