import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAssignment } from "./assignment-validator";
import { db } from "@/lib/db";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

type Shift = { id: string; startTime: Date; endTime: Date };
type Employee = {
  id: string;
  isActive: boolean;
  maxHoursPerWeek: number | null;
  availabilitySchedule: Record<string, { startTime: string; endTime: string }> | null;
};

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    startTime: new Date(Date.now() + 86400000), // tomorrow
    endTime: new Date(Date.now() + 86400000 + 4 * 3600000),
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    isActive: true,
    maxHoursPerWeek: 40,
    availabilitySchedule: null,
    ...overrides,
  };
}

/** The next future UTC instant that falls on `dayOfWeek` (0=Sun..6=Sat), at the given UTC hour. */
function nextUtc(dayOfWeek: number, hourUtc: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1); // ensure strictly in the future
  while (d.getUTCDay() !== dayOfWeek) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

describe("validateAssignment", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects an inactive employee before touching the database", async () => {
    const result = await validateAssignment(
      makeShift() as any,
      makeEmployee({ isActive: false }) as any,
      "UTC"
    );
    expect(result).toEqual({ ok: false, code: "EMPLOYEE_INACTIVE", message: expect.any(String) });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejects assigning a shift that has already started", async () => {
    const result = await validateAssignment(
      makeShift({ startTime: new Date("2020-01-01T00:00:00Z") }) as any,
      makeEmployee() as any,
      "UTC"
    );
    expect(result).toEqual({ ok: false, code: "PAST_SHIFT", message: expect.any(String) });
  });

  it("rejects a duplicate assignment", async () => {
    (db.select as any).mockReturnValueOnce(chain([{ id: "existing-assignment" }]));
    const result = await validateAssignment(makeShift() as any, makeEmployee() as any, "UTC");
    expect(result).toEqual({ ok: false, code: "DUPLICATE_ASSIGNMENT", message: expect.any(String) });
  });

  it("rejects a shift outside the employee's stated availability", async () => {
    const shift = makeShift({
      startTime: nextUtc(1, 20), // next Monday, 20:00 UTC
      endTime: nextUtc(1, 22),
    });
    const employee = makeEmployee({
      availabilitySchedule: { "1": { startTime: "09:00", endTime: "17:00" } }, // Monday 9-5
    });
    (db.select as any).mockReturnValueOnce(chain([])); // no duplicate
    const result = await validateAssignment(shift as any, employee as any, "UTC");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("OUTSIDE_AVAILABILITY");
  });

  it("rejects a shift on a day with approved time off", async () => {
    const shift = makeShift({
      startTime: nextUtc(1, 12),
      endTime: nextUtc(1, 16),
    });
    (db.select as any)
      .mockReturnValueOnce(chain([])) // no duplicate
      .mockReturnValueOnce(chain([{ id: "time-off-1" }])); // approved time off that day
    const result = await validateAssignment(shift as any, makeEmployee() as any, "UTC");
    expect(result).toEqual({ ok: false, code: "TIME_OFF_CONFLICT", message: expect.any(String) });
  });

  it("rejects an overlapping shift assignment", async () => {
    (db.select as any)
      .mockReturnValueOnce(chain([])) // no duplicate
      .mockReturnValueOnce(chain([])) // no time off
      .mockReturnValueOnce(chain([{ id: "overlap-shift" }])); // overlapping
    const result = await validateAssignment(makeShift() as any, makeEmployee() as any, "UTC");
    expect(result).toEqual({ ok: false, code: "OVERLAPPING_SHIFT", message: expect.any(String) });
  });

  it("allows the assignment when every check passes", async () => {
    (db.select as any)
      .mockReturnValueOnce(chain([])) // no duplicate
      .mockReturnValueOnce(chain([])) // no time off
      .mockReturnValueOnce(chain([])) // no overlap
      .mockReturnValueOnce(chain([])); // no existing week assignments
    const result = await validateAssignment(makeShift() as any, makeEmployee() as any, "UTC");
    expect(result).toEqual({ ok: true });
  });

  it("rejects when the shift would push the employee over their weekly cap", async () => {
    const shift = makeShift({
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 86400000 + 5 * 3600000), // 5h shift
    });
    (db.select as any)
      .mockReturnValueOnce(chain([])) // no duplicate
      .mockReturnValueOnce(chain([])) // no time off
      .mockReturnValueOnce(chain([])) // no overlap
      .mockReturnValueOnce(
        chain([{ startTime: new Date(shift.startTime), endTime: new Date(shift.startTime.getTime() + 36 * 3600000) }])
      ); // 36h already scheduled this week
    const result = await validateAssignment(shift as any, makeEmployee({ maxHoursPerWeek: 40 }) as any, "UTC");
    expect(result).toEqual({ ok: false, code: "EXCEEDS_MAX_HOURS", message: expect.any(String) });
  });
});

// The weekly-hours-cap boundary itself (getZonedWeekStart) — including the
// exact server-UTC-vs-branch-timezone scenario this function exists to fix —
// is unit-tested directly in lib/utils/timezone.test.ts, since db.select is
// fully mocked here and never actually evaluates the gte/lte week-window
// conditions built from it.
