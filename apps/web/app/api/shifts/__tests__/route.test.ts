import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };

function getReq(url = "http://test/api/shifts") {
  return new Request(url);
}
function postReq(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/shifts", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns [] for a branch manager with no branch", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u3", role: "branch_manager", organizationId: "org-1", branchId: null });
    const res = await GET(getReq());
    expect(await res.json()).toEqual([]);
  });

  it("includes assignments alongside each shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }])) // org branch ids
      .mockReturnValueOnce(chain([{ id: "s1", branchId: "b1", startTime: new Date(), endTime: new Date(), isPublished: true }]))
      .mockReturnValueOnce(chain([{ id: "a1", shiftId: "s1", employeeId: "e1", employeeName: "Alice", jobRoleId: null }]));
    const res = await GET(getReq());
    const body = await res.json();
    expect(body[0].assignments).toHaveLength(1);
  });
});

describe("POST /api/shifts", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T09:00:00Z", endTime: "2024-01-01T17:00:00Z" }));
    expect(res.status).toBe(403);
  });

  it("rejects end time before start time", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T17:00:00Z", endTime: "2024-01-01T09:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("rejects a shift shorter than the minimum duration", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T09:00:00Z", endTime: "2024-01-01T09:05:00Z" }));
    expect(res.status).toBe(400);
  });

  it("rejects a shift longer than the maximum duration", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T00:00:00Z", endTime: "2024-01-03T01:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("404s when the branch isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T09:00:00Z", endTime: "2024-01-01T17:00:00Z" }));
    expect(res.status).toBe(404);
  });

  it("rejects an exact-duplicate shift at the same branch", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(chain([{ id: "existing-shift" }]));
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T09:00:00Z", endTime: "2024-01-01T17:00:00Z" }));
    expect(res.status).toBe(409);
  });

  it("creates the shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(chain([]));
    const created = { id: "s1" };
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(postReq({ branchId: "550e8400-e29b-41d4-a716-446655440000", startTime: "2024-01-01T09:00:00Z", endTime: "2024-01-01T17:00:00Z" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });
});
