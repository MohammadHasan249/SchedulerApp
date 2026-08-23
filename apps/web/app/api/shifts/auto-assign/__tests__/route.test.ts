import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { autoAssignShifts } from "@/lib/scheduling/auto-assign";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/scheduling/auto-assign", () => ({ autoAssignShifts: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const validBody = {
  branchId: "550e8400-e29b-41d4-a716-446655440000",
  fromDate: "2024-01-01T00:00:00Z",
  toDate: "2024-01-07T23:59:59Z",
};

describe("POST /api/shifts/auto-assign", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("rejects a branch manager with no branch assigned", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(req(validBody));
    expect(res.status).toBe(400);
  });

  it("forbids a branch manager targeting a different branch", async () => {
    (getApiUser as any).mockResolvedValue({ ...manager, branchId: "other-branch" });
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("404s when the branch isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(req(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 500 when auto-assign throws", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "b1" }]));
    (autoAssignShifts as any).mockRejectedValue(new Error("boom"));
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
  });

  it("returns the created assignments on success", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "b1" }]));
    (autoAssignShifts as any).mockResolvedValue([{ shiftId: "s1", employeeId: "e1" }]);
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, assignmentsCreated: 1, assignments: [{ shiftId: "s1", employeeId: "e1" }] });
  });
});
