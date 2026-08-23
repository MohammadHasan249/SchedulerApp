import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

describe("GET /api/dashboard/stats", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from viewing dashboard stats", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "employee", organizationId: "org-1", branchId: null });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns zeroed stats for a branch manager with no branch assigned", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "branch_manager", organizationId: "org-1", branchId: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clockedInCount: 0,
      totalShiftsToday: 0,
      pendingTimeOffCount: 0,
      todayShifts: [],
    });
  });

  it("aggregates clocked-in, shift, and time-off counts for an org admin", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "org_admin", organizationId: "org-1", branchId: null });

    const start = new Date("2024-01-01T09:00:00Z");
    const end = new Date("2024-01-01T17:00:00Z");

    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "branch-1" }])) // branches for org
      .mockReturnValueOnce(chain([{ id: "emp-1" }, { id: "emp-2" }])) // active org employees
      .mockReturnValueOnce(chain([{ id: "shift-1", startTime: start, endTime: end, employeeName: "Alice" }])) // shifts
      .mockReturnValueOnce(chain([{ employeeId: "emp-1", type: "clock_in" }])) // clock events
      .mockReturnValueOnce(chain([{ id: "req-1" }])); // pending time-off

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clockedInCount: 1,
      totalShiftsToday: 1,
      pendingTimeOffCount: 1,
      todayShifts: [{ id: "shift-1", startTime: start.toISOString(), endTime: end.toISOString(), employeeName: "Alice" }],
    });
  });
});
