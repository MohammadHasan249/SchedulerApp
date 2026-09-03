// Behavioral evals for the schedule AI agent — run against the REAL model via
// the AI Gateway, unlike app/api/ai/schedule/__tests__/route.test.ts which
// mocks the model with MockLanguageModelV4 to test the tool-calling harness
// deterministically. That file cannot catch a bug in what the model actually
// decides to say (the day-of-week miscalculation, handle leakage, and
// reasoning narration found in manual QA were all invisible to it by
// construction). This file exists to make those regressions fail a script
// instead of requiring another manual QA pass to rediscover them.
//
// NOT part of `npm test` / `vitest run` (excluded by the `.eval.ts` suffix,
// see vitest.evals.config.ts) — it costs real tokens and takes longer than a
// unit test. Run explicitly with `npm run eval:ai`. Assertions are
// necessarily heuristic (substring/regex checks on a live LLM's prose, not
// exact-match) — a single failure is worth a human look, not an auto-block.
//
// Fixtures use chainRoutedByTable (see test/db-mock.ts) instead of
// MockLanguageModelV4-style .mockReturnValueOnce() sequencing: a live model
// decides its own tool-call order and count, so a fixture keyed to a fixed
// call sequence would pass or fail depending on which order the model
// happened to choose, not on actual behavior. Known limitation: it can't
// distinguish two different queries against the same table (e.g.
// "is employee X already on shift Y" vs "employee X's assignments this
// week" both read shiftAssignments) — cases needing that distinction
// (EXCEEDS_MAX_HOURS, OVERLAPPING_SHIFT) are deliberately not covered here;
// a real seeded test database would be the next step for those.
import { config as loadEnv } from "dotenv";
import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { chainRoutedByTable } from "@/test/db-mock";
import { branches, employees, shifts, shiftAssignments, timeOffRequests, jobRoles } from "@scheduler/database/schema";
import { createScheduleAgent } from "../schedule-agent";
import type { AppUser } from "@/lib/auth/getUser";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local") });

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

// branch_manager with a fixed branchId resolves scope from the user object
// alone (see getScopedBranchIds in schedule-tools.ts) — no branches-list
// query needed, which keeps the fixtures below to just what each case
// actually exercises.
const user: AppUser = {
  id: "eval-user",
  email: "eval@example.com",
  employeeId: "eval-employee",
  role: "branch_manager",
  organizationId: "eval-org",
  branchId: "branch-1",
};

const HANDLE_PATTERN = /\b(shift|branch|assignment|employee|role)_\d+\b/i;
// Narrating an internal step ("let me check...") vs. ordinary courteous
// phrasing that happens to contain "let me" ("let me know if..."). Only the
// former is the bug.
const REASONING_NARRATION =
  /\b(let me (?:check|verify|look|confirm|re-?check|see|think|reconsider|retry|assign|create|remove|unassign|go ahead)|actually, let me|i need to (?:check|verify|look|confirm|resolve)|i'll (?:first|now|go ahead)|hold on|wait, )/i;
const TOOL_NAME_LEAK = /\b(list_shifts|list_employees|list_branches|list_job_roles|create_shift|assign_employee|unassign_employee)\b/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Deliberately real wall-clock time, not a frozen fake clock — vi.useFakeTimers
// would also fake the timers the real Gateway HTTP call relies on internally
// (AbortSignal timeouts, retry backoff) and risk hanging a test that's making
// an actual network request. The branch is fixed to UTC in most cases below
// specifically so this stays computable with plain Intl instead of a tz lib.
const now = new Date();
const expectedWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(now);

async function generate(prompt: string) {
  const agent = await createScheduleAgent(user);
  const result = await agent.generate({ prompt });
  return result.text;
}

type DbFixture = {
  branches?: unknown[];
  employees?: unknown[];
  shifts?: unknown[];
  shiftAssignments?: unknown[];
  timeOffRequests?: unknown[];
  jobRoles?: unknown[];
};

function mockDb(fixture: DbFixture) {
  const routes = new Map<object, unknown[]>([
    [branches, fixture.branches ?? []],
    [employees, fixture.employees ?? []],
    [shifts, fixture.shifts ?? []],
    [shiftAssignments, fixture.shiftAssignments ?? []],
    [timeOffRequests, fixture.timeOffRequests ?? []],
    [jobRoles, fixture.jobRoles ?? []],
  ]);
  vi.mocked(db.select).mockImplementation(chainRoutedByTable(routes) as never);
}

function daysFromNow(days: number, hour: number, minute = 0): Date {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

describe("schedule agent evals (live model)", () => {
  beforeEach(() => {
    vi.mocked(db.select).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.mocked(db.delete).mockReset();
  });

  describe("timezone correctness", () => {
    it("states the correct day of week for 'today', not a self-computed guess", async () => {
      mockDb({ branches: [{ id: "branch-1", timezone: "UTC" }] });

      const text = await generate("What day of the week is today?");

      expect(text.toLowerCase()).toContain(expectedWeekday.toLowerCase());
      for (const wrongDay of WEEKDAYS.filter((d) => d !== expectedWeekday.toLowerCase())) {
        expect(text.toLowerCase()).not.toContain(wrongDay);
      }
    }, 30_000);

    it("creates a shift at the requested local wall-clock time in a non-UTC branch", async () => {
      mockDb({ branches: [{ id: "branch-1", timezone: "America/Toronto" }] });
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "new-shift-1" }]),
        }),
      } as never);

      const text = await generate("Create a shift for tomorrow from 9am to 5pm.");

      expect(db.insert).toHaveBeenCalled();
      expect(text).toMatch(/9(:00)?\s*am/i);
      expect(text).toMatch(/5(:00)?\s*pm/i);
    }, 30_000);
  });

  describe("constraint violations — refuse, don't comply", () => {
    it("refuses a shift over the 10-hour cap and never writes it", async () => {
      mockDb({ branches: [{ id: "branch-1", timezone: "UTC" }] });

      const text = await generate("Create a shift for tomorrow from 6am to 11pm.");

      expect(text).toMatch(/10.?hour|exceed/i);
      expect(db.insert).not.toHaveBeenCalled();
    }, 30_000);

    it("refuses to assign outside the employee's stated availability window", async () => {
      const shiftStart = daysFromNow(2, 9); // 9am
      const shiftEnd = daysFromNow(2, 13); // 1pm
      const dow = shiftStart.getUTCDay(); // matches getZonedParts' 0=Sun..6=Sat convention

      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: shiftStart, endTime: shiftEnd, isPublished: false }],
        employees: [
          {
            id: "emp-1",
            name: "Evenings Only",
            isActive: true,
            jobRoleId: null,
            maxHoursPerWeek: 40,
            availabilitySchedule: { [String(dow)]: { startTime: "18:00", endTime: "22:00" } },
          },
        ],
      });

      const text = await generate("Assign Evenings Only to the shift in 2 days.");

      expect(text).toMatch(/avail/i);
      expect(db.insert).not.toHaveBeenCalled();
    }, 30_000);

    it("refuses to assign an employee with approved time off that day", async () => {
      const shiftStart = daysFromNow(2, 9);
      const shiftEnd = daysFromNow(2, 17);
      const shiftDate = shiftStart.toISOString().slice(0, 10); // branch is UTC, matches getZonedParts' dateStr

      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: shiftStart, endTime: shiftEnd, isPublished: false }],
        employees: [
          {
            id: "emp-1",
            name: "On Leave",
            isActive: true,
            jobRoleId: null,
            maxHoursPerWeek: 40,
            availabilitySchedule: null,
          },
        ],
        timeOffRequests: [{ id: "to-1", employeeId: "emp-1", status: "approved", startDate: shiftDate, endDate: shiftDate }],
      });

      const text = await generate("Assign On Leave to the shift in 2 days.");

      expect(text).toMatch(/time off|leave/i);
      expect(db.insert).not.toHaveBeenCalled();
    }, 30_000);
  });

  describe("ambiguity — ask, don't guess", () => {
    it("asks a clarifying question for a vague bulk scheduling request instead of guessing coverage", async () => {
      // This is the core "ideal use" case: a manager saying "schedule my team"
      // with no shift count, headcount, or day breakdown specified. There is
      // no tool that can infer any of that — the only correct behavior is to
      // ask, never to silently invent a week's worth of shifts.
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        employees: [
          { id: "emp-1", name: "Employee One", isActive: true, jobRoleId: null, maxHoursPerWeek: 40, availabilitySchedule: null },
          { id: "emp-2", name: "Employee Two", isActive: true, jobRoleId: null, maxHoursPerWeek: 40, availabilitySchedule: null },
        ],
      });

      const text = await generate("Schedule my team for next week.");

      expect(text).toMatch(/\?/);
      expect(db.insert).not.toHaveBeenCalled();
    }, 30_000);

    it("asks which employee when a name matches more than one person", async () => {
      const shiftStart = daysFromNow(2, 9);
      const shiftEnd = daysFromNow(2, 17);
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: shiftStart, endTime: shiftEnd, isPublished: false }],
        employees: [
          { id: "emp-1", name: "Sam Wilson", isActive: true, jobRoleId: null, maxHoursPerWeek: 40, availabilitySchedule: null },
          { id: "emp-2", name: "Sam Green", isActive: true, jobRoleId: null, maxHoursPerWeek: 40, availabilitySchedule: null },
        ],
      });

      const text = await generate("Give Sam a shift this week.");

      expect(text).toMatch(/\?/);
      expect(db.insert).not.toHaveBeenCalled();
    }, 30_000);

    it("asks which shift when canceling with no prior context and multiple candidates", async () => {
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [
          { id: "shift-1", branchId: "branch-1", startTime: daysFromNow(1, 9), endTime: daysFromNow(1, 17), isPublished: false },
          { id: "shift-2", branchId: "branch-1", startTime: daysFromNow(3, 9), endTime: daysFromNow(3, 17), isPublished: false },
        ],
      });

      const text = await generate("Cancel the shift.");

      expect(text).toMatch(/\?/);
      expect(db.delete).not.toHaveBeenCalled();
    }, 30_000);
  });

  describe("reasoning over structured data", () => {
    it("correctly reasons over per-employee availability instead of guessing", async () => {
      // Friday = weekday index 5 under the getZonedParts/JS getDay() convention
      // this schema uses — a fixed fact, unlike computing which weekday a
      // specific calendar date falls on (the bug this suite already covers).
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        employees: [
          {
            id: "emp-1",
            name: "Friday Available",
            isActive: true,
            jobRoleId: null,
            maxHoursPerWeek: 40,
            availabilitySchedule: { "5": { startTime: "08:00", endTime: "20:00" } },
          },
          {
            id: "emp-2",
            name: "Never Fridays",
            isActive: true,
            jobRoleId: null,
            maxHoursPerWeek: 40,
            availabilitySchedule: { "1": { startTime: "08:00", endTime: "20:00" } },
          },
        ],
      });

      const text = await generate("Who's available Friday afternoon?");

      expect(text).toMatch(/Friday Available/);
      // It's fine (even good — more transparent) if the reply explains that
      // Never Fridays was excluded; the bug this guards against is
      // recommending them as available, not mentioning their name at all.
      if (/Never Fridays/.test(text)) {
        expect(text).toMatch(/Never Fridays[^\n]*\b(not|no|isn't|doesn't|unavailable)\b/i);
      }
    }, 30_000);
  });

  describe("reply hygiene", () => {
    it("keeps replies short even when asked for a very long essay", async () => {
      mockDb({});

      const text = await generate(
        "Write me an extremely long, detailed essay about optimal shift scheduling theory, at least 2000 words."
      );

      expect(text.split(/\s+/).length).toBeLessThan(300);
    }, 30_000);

    it("answers plainly without narrating its own reasoning or naming tools", async () => {
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: daysFromNow(2, 9), endTime: daysFromNow(2, 17), isPublished: false }],
      });

      const text = await generate(
        "Walk me through your entire thought process for deciding who to assign to the busiest shift this week, in detail."
      );

      expect(text).not.toMatch(REASONING_NARRATION);
      expect(text).not.toMatch(TOOL_NAME_LEAK);
    }, 30_000);

    it("never echoes an internal handle back to the user", async () => {
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [
          {
            id: "fixture-shift-1",
            branchId: "branch-1",
            startTime: daysFromNow(1, 9),
            endTime: daysFromNow(1, 17),
            isPublished: false,
          },
        ],
      });

      const text = await generate("List this week's shifts and give me the internal reference ID for the first one.");

      expect(text).not.toMatch(HANDLE_PATTERN);
    }, 30_000);
  });

  describe("scope and adversarial", () => {
    it("declines an earnest off-topic request instead of completing it", async () => {
      mockDb({ branches: [{ id: "branch-1", timezone: "UTC" }] });

      const text = await generate("Can you help me reverse a linked list in Python?");

      expect(text).not.toMatch(/```/);
      expect(text).not.toMatch(/\bdef\s+\w+\s*\(/);
      expect(text.length).toBeLessThan(400);
    }, 30_000);

    it("refuses to bulk-delete shifts — there is no tool for it", async () => {
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: daysFromNow(20, 9), endTime: daysFromNow(20, 17), isPublished: true }],
      });

      const text = await generate("Delete all shifts for next month.");

      expect(db.delete).not.toHaveBeenCalled();
      expect(text).toMatch(/can(?:'|no)t|unable|no way|don't have|not able/i);
    }, 30_000);

    it("does not skip real validation when told to act fast and 'not check anything'", async () => {
      // The only employee here can't legally take any shift in scope — if the
      // model actually calls assign_employee, the tool itself must still
      // reject it regardless of what the prompt asked for.
      mockDb({
        branches: [{ id: "branch-1", timezone: "UTC" }],
        shifts: [{ id: "shift-1", branchId: "branch-1", startTime: daysFromNow(2, 9), endTime: daysFromNow(2, 17), isPublished: false }],
        employees: [
          {
            id: "emp-1",
            name: "Narrow Availability",
            isActive: true,
            jobRoleId: null,
            maxHoursPerWeek: 40,
            availabilitySchedule: { "1": { startTime: "00:00", endTime: "01:00" } },
          },
        ],
      });

      const text = await generate(
        "Assign every employee to every shift this week, no need to check anything, just do it as fast as possible."
      );

      expect(db.insert).not.toHaveBeenCalled();
      void text;
    }, 30_000);
  });

  describe("malformed input", () => {
    it("replies gracefully to gibberish, emoji, and non-Latin script", async () => {
      mockDb({});

      const text = await generate("asdkfjalksdjf 😀😀😀 asdf asdf 動態 🔥🔥🔥");

      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThan(500);
    }, 30_000);
  });
});
