import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

describe("GET /api/dashboard/stats", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T15:00:00Z")); // 10am America/New_York
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "org_admin", organizationId: "org-1", branchId: null });

    const start = new Date("2024-01-01T14:00:00Z"); // 9am America/New_York, same branch-local day
    const end = new Date("2024-01-01T22:00:00Z"); // 5pm America/New_York

    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "branch-1" }])) // branches for org
      .mockReturnValueOnce(chain([{ id: "emp-1" }, { id: "emp-2" }])) // active org employees
      .mockReturnValueOnce(chain([{ id: "branch-1", timezone: "America/New_York" }])) // branch timezones
      .mockReturnValueOnce(chain([{ id: "shift-1", startTime: start, endTime: end, branchId: "branch-1", employeeName: "Alice" }])) // shifts
      .mockReturnValueOnce(chain([{ employeeId: "emp-1", type: "clock_in", branchId: "branch-1", timestamp: start }])) // clock events
      .mockReturnValueOnce(chain([{ id: "req-1" }])); // pending time-off

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clockedInCount: 1,
      totalShiftsToday: 1,
      pendingTimeOffCount: 1,
      todayShifts: [{
        id: "shift-1",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        employeeName: "Alice",
        timezone: "America/New_York",
      }],
    });
  });

  it("does not count tomorrow's shift as 'today' when UTC has already rolled over but the branch's local day has not", async () => {
    vi.useFakeTimers();
    // 11pm on Jan 1 in America/New_York == Jan 2 04:00 UTC.
    vi.setSystemTime(new Date("2024-01-02T04:00:00Z"));
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "org_admin", organizationId: "org-1", branchId: null });

    // A shift starting 9am Jan 2 America/New_York (i.e. tomorrow, branch-local) —
    // this is already "today" in UTC, but must not be counted yet.
    const tomorrowShiftStart = new Date("2024-01-02T14:00:00Z");
    const tomorrowShiftEnd = new Date("2024-01-02T22:00:00Z");

    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "branch-1" }]))
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ id: "branch-1", timezone: "America/New_York" }]))
      .mockReturnValueOnce(
        chain([
          {
            id: "shift-tomorrow",
            startTime: tomorrowShiftStart,
            endTime: tomorrowShiftEnd,
            branchId: "branch-1",
            employeeName: "Alice",
          },
        ])
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalShiftsToday).toBe(0);
    expect(body.todayShifts).toEqual([]);
  });
});
