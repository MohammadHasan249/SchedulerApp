import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoAssignShifts, buildTimeOffMap, isOnTimeOff } from "./auto-assign";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { and, eq, ne } from "drizzle-orm";
import { chain } from "@/test/db-mock";

// Mock database calls
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

const testOrgId = "org-123";
const testBranchId = "branch-123";
const fromDate = new Date("2024-01-01T00:00:00Z");
const toDate = new Date("2024-01-07T23:59:59Z");

// A Monday shift with no per-role requirements — needs exactly one body.
const openShift = {
  id: "shift-1",
  branchId: testBranchId,
  startTime: new Date("2024-01-01T14:00:00Z"),
  endTime: new Date("2024-01-01T18:00:00Z"),
  isPublished: false,
};

const availableEmployee = {
  id: "emp-1",
  organizationId: testOrgId,
  isActive: true,
  jobRoleId: null,
  maxHoursPerWeek: 40,
  // Monday (dayOfWeek 1) 09:00-20:00 covers the shift above.
  availabilitySchedule: { "1": { startTime: "09:00", endTime: "20:00" } },
};

/**
 * Mocks the fixed call sequence autoAssignShifts makes via db.select:
 * candidateShifts, branchRow, existingAssignmentsByShift, allEmployees,
 * approvedTimeOff, existingAssignments (hours), allRoleRequirements.
 */
function mockSelectSequence(opts: {
  shifts?: unknown[];
  branch?: unknown[];
  existingByShift?: unknown[];
  employees?: unknown[];
  timeOff?: unknown[];
  hoursAssignments?: unknown[];
  roleRequirements?: unknown[];
}) {
  (db.select as any)
    .mockReturnValueOnce(chain(opts.shifts ?? []))
    .mockReturnValueOnce(chain(opts.branch ?? [{ timezone: "UTC" }]))
    .mockReturnValueOnce(chain(opts.existingByShift ?? []))
    .mockReturnValueOnce(chain(opts.employees ?? []))
    .mockReturnValueOnce(chain(opts.timeOff ?? []))
    .mockReturnValueOnce(chain(opts.hoursAssignments ?? []))
    .mockReturnValueOnce(chain(opts.roleRequirements ?? []));
}

describe("autoAssignShifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.insert as any).mockReturnValue(chain([]));
  });

  it("should return empty array when no shifts exist", async () => {
    // The candidate-shifts query is db.select().from(shifts).where(...)
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    expect(result).toEqual([]);
  });

  it("assigns an available employee to a shift with no existing assignments", async () => {
    mockSelectSequence({
      shifts: [openShift],
      employees: [availableEmployee],
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    expect(result).toEqual([{ shiftId: "shift-1", employeeId: "emp-1", jobRoleId: null }]);
    expect(db.insert).toHaveBeenCalled();
  });

  it("regression (BUGS.md #5): does not double-book a shift that already has an assignment when no role requirements are set", async () => {
    // Re-running auto-assign on a shift that already has one person and no
    // per-role headcount requirement used to add a *second* assignment every
    // time, because the old code only tracked "assigned in this run," not
    // pre-existing assignments.
    mockSelectSequence({
      shifts: [openShift],
      existingByShift: [{ shiftId: "shift-1", employeeId: "emp-already-assigned", jobRoleId: null }],
      employees: [availableEmployee, { ...availableEmployee, id: "emp-already-assigned" }],
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    expect(result).toEqual([]);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("regression (BUGS.md #5): only fills the remaining headcount gap for a role, never overshoots", async () => {
    const shiftWithRole = { ...openShift };
    const roleRequirement = { shiftId: "shift-1", jobRoleId: "role-cook", headcount: 2 };
    const candidate2 = { ...availableEmployee, id: "emp-2", jobRoleId: "role-cook" };
    const candidate3 = { ...availableEmployee, id: "emp-3", jobRoleId: "role-cook" };

    mockSelectSequence({
      shifts: [shiftWithRole],
      // One of the two required "role-cook" seats is already filled.
      existingByShift: [{ shiftId: "shift-1", employeeId: "emp-already-cook", jobRoleId: "role-cook" }],
      employees: [candidate2, candidate3, { ...availableEmployee, id: "emp-already-cook", jobRoleId: "role-cook" }],
      roleRequirements: [roleRequirement],
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    // Exactly one new assignment (filling the single remaining seat), not two.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ shiftId: "shift-1", jobRoleId: "role-cook" });
  });

  it("does not assign an employee who is on approved time off that day", async () => {
    mockSelectSequence({
      shifts: [openShift],
      employees: [availableEmployee],
      timeOff: [{ employeeId: "emp-1", startDate: "2024-01-01", endDate: "2024-01-01" }],
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);
    expect(result).toEqual([]);
  });

  it("does not assign an employee whose availability doesn't cover the shift", async () => {
    mockSelectSequence({
      shifts: [openShift],
      employees: [{ ...availableEmployee, availabilitySchedule: { "1": { startTime: "09:00", endTime: "13:00" } } }], // ends before shift start
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);
    expect(result).toEqual([]);
  });

  it("does not assign an employee who would exceed their weekly hour cap", async () => {
    mockSelectSequence({
      shifts: [openShift],
      employees: [{ ...availableEmployee, maxHoursPerWeek: 2 }], // shift is 4h
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);
    expect(result).toEqual([]);
  });

  it("scopes the candidate query to employees at the shift's own branch", async () => {
    // Regression: findBestCandidate has no branch check of its own — it trusts
    // the candidate list handed to it. Without this filter on the employees
    // query, someone from a different branch could be auto-assigned here,
    // with their availability then evaluated against the wrong branch's
    // timezone (see REGR-03 investigation).
    let employeesWhereArg: unknown;
    (db.select as any)
      .mockReturnValueOnce(chain([openShift])) // candidateShifts
      .mockReturnValueOnce(chain([{ timezone: "UTC" }])) // branch
      .mockReturnValueOnce(chain([])) // existingByShift
      .mockReturnValueOnce({
        from: () => ({
          where: (arg: unknown) => {
            employeesWhereArg = arg;
            return chain([availableEmployee]);
          },
        }),
      }) // allEmployees — the query under test
      .mockReturnValueOnce(chain([])) // timeOff
      .mockReturnValueOnce(chain([])) // hoursAssignments
      .mockReturnValueOnce(chain([])); // roleRequirements

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);

    expect(result).toEqual([{ shiftId: "shift-1", employeeId: "emp-1", jobRoleId: null }]);
    expect(employeesWhereArg).toEqual(
      and(
        eq(employees.organizationId, testOrgId),
        eq(employees.branchId, testBranchId),
        eq(employees.isActive, true),
        ne(employees.role, "org_admin")
      )
    );
  });

  it("prefers the job-role match over lower hours when both are candidates", async () => {
    const roleRequirement = { shiftId: "shift-1", jobRoleId: "role-cook", headcount: 1 };
    const matchingButBusier = { ...availableEmployee, id: "emp-match", jobRoleId: "role-cook" };
    const nonMatchingButFree = { ...availableEmployee, id: "emp-free", jobRoleId: "role-other" };

    mockSelectSequence({
      shifts: [openShift],
      employees: [nonMatchingButFree, matchingButBusier],
      // emp-match already has 10h this week; emp-free has 0h — but role match wins.
      hoursAssignments: [
        { employeeId: "emp-match", startTime: new Date("2024-01-01T00:00:00Z"), endTime: new Date("2024-01-01T10:00:00Z") },
      ],
      roleRequirements: [roleRequirement],
    });

    const result = await autoAssignShifts(testOrgId, testBranchId, fromDate, toDate);
    expect(result).toEqual([{ shiftId: "shift-1", employeeId: "emp-match", jobRoleId: "role-cook" }]);
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
