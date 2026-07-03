import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoAssignShifts, buildTimeOffMap, isOnTimeOff } from "./auto-assign";
import { db } from "@/lib/db";

// Mock database calls
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("autoAssignShifts", () => {
  const testOrgId = "org-123";
  const testBranchId = "branch-123";
  const fromDate = new Date("2024-01-01T00:00:00Z");
  const toDate = new Date("2024-01-07T23:59:59Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when no shifts exist", async () => {
    // The candidate-shifts query is db.select().from(shifts).where(...)
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    expect(result).toEqual([]);
  });
});

describe("buildTimeOffMap", () => {
  const fromDate = new Date("2024-01-01T00:00:00Z");
  const toDate = new Date("2024-01-07T23:59:59Z");

  it("groups overlapping requests by employee as date intervals", () => {
    const map = buildTimeOffMap(
      [
        { employeeId: "e1", startDate: "2024-01-02", endDate: "2024-01-03" },
        { employeeId: "e1", startDate: "2024-01-06", endDate: "2024-01-06" },
        { employeeId: "e2", startDate: "2024-01-05", endDate: "2024-01-09" },
      ],
      fromDate,
      toDate
    );

    expect(map.get("e1")).toEqual([
      { start: "2024-01-02", end: "2024-01-03" },
      { start: "2024-01-06", end: "2024-01-06" },
    ]);
    expect(map.get("e2")).toEqual([{ start: "2024-01-05", end: "2024-01-09" }]);
  });

  it("drops requests entirely outside the planning window", () => {
    const map = buildTimeOffMap(
      [
        { employeeId: "e1", startDate: "2023-11-01", endDate: "2023-11-05" },
        { employeeId: "e1", startDate: "2024-03-01", endDate: "2024-03-02" },
      ],
      fromDate,
      toDate
    );

    expect(map.size).toBe(0);
  });

  it("keeps requests that only touch the window at a local-time boundary", () => {
    // Ends one day before the UTC window start: still kept, because a shift
    // late on 2023-12-31 in a western timezone can fall inside the window
    // in UTC while its branch-local date is 2023-12-31.
    const map = buildTimeOffMap(
      [{ employeeId: "e1", startDate: "2023-12-28", endDate: "2023-12-31" }],
      fromDate,
      toDate
    );

    expect(map.get("e1")).toEqual([{ start: "2023-12-28", end: "2023-12-31" }]);
  });
});

describe("isOnTimeOff", () => {
  const intervals = [
    { start: "2024-01-02", end: "2024-01-03" },
    { start: "2024-01-06", end: "2024-01-06" },
  ];

  it("matches dates inside an interval (inclusive bounds)", () => {
    expect(isOnTimeOff(intervals, "2024-01-02")).toBe(true);
    expect(isOnTimeOff(intervals, "2024-01-03")).toBe(true);
    expect(isOnTimeOff(intervals, "2024-01-06")).toBe(true);
  });

  it("rejects dates outside every interval", () => {
    expect(isOnTimeOff(intervals, "2024-01-01")).toBe(false);
    expect(isOnTimeOff(intervals, "2024-01-04")).toBe(false);
    expect(isOnTimeOff(intervals, "2024-01-07")).toBe(false);
  });

  it("treats missing intervals as no time off", () => {
    expect(isOnTimeOff(undefined, "2024-01-02")).toBe(false);
    expect(isOnTimeOff([], "2024-01-02")).toBe(false);
  });
});
