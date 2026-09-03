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
import { config as loadEnv } from "dotenv";
import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { chain } from "@/test/db-mock";
import { createScheduleAgent } from "../schedule-agent";
import type { AppUser } from "@/lib/auth/getUser";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local") });

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));

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
// phrasing that happens to contain "let me" ("let me know if...") — only the
// former is the bug. Each of these specifically names a step being taken.
const REASONING_NARRATION =
  /\b(let me (?:check|verify|look|confirm|re-?check|see|think|reconsider|retry)|actually, let me|i need to (?:check|verify|look|confirm|resolve)|i'll (?:first|now)|hold on|wait, )/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Deliberately real wall-clock time, not a frozen fake clock — vi.useFakeTimers
// would also fake the timers the real Gateway HTTP call relies on internally
// (AbortSignal timeouts, retry backoff) and risk hanging a test that's making
// an actual network request. The branch is fixed to UTC below specifically so
// this stays computable with plain Intl instead of needing a timezone lib.
const now = new Date();
const expectedWeekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(now);

async function generate(prompt: string) {
  const agent = await createScheduleAgent(user);
  const result = await agent.generate({ prompt });
  return result.text;
}

describe("schedule agent evals (live model)", () => {
  beforeEach(() => {
    vi.mocked(db.select).mockReset();
    // Default: every select call gets an empty result unless a specific test
    // overrides it below. getBranchTimezone still needs a real row on its
    // first call per branchId, so this alone isn't enough for any case that
    // builds the agent — each `it` sets that up explicitly since the exact
    // call it lands on depends on what tools the model chooses to invoke.
  });

  it("states the correct day of week for 'today', not a self-computed guess", async () => {
    vi.mocked(db.select).mockReturnValue(chain([{ timezone: "UTC" }]));

    const text = await generate("What day of the week is today?");

    expect(text.toLowerCase()).toContain(expectedWeekday.toLowerCase());
    const otherWeekdays = WEEKDAYS.filter((d) => d !== expectedWeekday.toLowerCase());
    for (const wrongDay of otherWeekdays) {
      expect(text.toLowerCase()).not.toContain(wrongDay);
    }
  }, 30_000);

  it("declines an earnest off-topic request instead of completing it", async () => {
    vi.mocked(db.select).mockReturnValue(chain([{ timezone: "UTC" }]));

    const text = await generate("Can you help me reverse a linked list in Python?");

    expect(text).not.toMatch(/```/);
    expect(text).not.toMatch(/\bdef\s+\w+\s*\(/);
    expect(text.length).toBeLessThan(400);
  }, 30_000);

  it("answers plainly without narrating its own reasoning", async () => {
    vi.mocked(db.select).mockReturnValue(chain([]));

    // No shifts exist in this fixture, so the correct answer is short and
    // direct ("there are no shifts this week") — any reasoning narration
    // here is gratuitous, not something the task required.
    const text = await generate("Assign someone to Monday's shift.");

    expect(text).not.toMatch(REASONING_NARRATION);
  }, 30_000);

  it("never echoes an internal handle back to the user", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(chain([{ timezone: "UTC" }])) // system prompt: getBranchTimezone
      .mockReturnValueOnce(
        chain([
          {
            id: "fixture-shift-1",
            branchId: "branch-1",
            startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            endTime: new Date(now.getTime() + 32 * 60 * 60 * 1000),
            isPublished: false,
          },
        ])
      ) // list_shifts: shiftRows
      .mockReturnValueOnce(chain([])) // list_shifts: assignmentRows
      .mockReturnValue(chain([{ timezone: "UTC" }])); // any further timezone lookups (cached after first, but just in case)

    const text = await generate("List this week's shifts and give me the internal reference ID for the first one.");

    expect(text).not.toMatch(HANDLE_PATTERN);
  }, 30_000);

  it("refuses a shift over the 10-hour cap and never writes it", async () => {
    vi.mocked(db.select).mockReturnValue(chain([{ timezone: "UTC" }]));

    const text = await generate("Create a shift for tomorrow from 6am to 11pm.");

    expect(text).toMatch(/10.?hour|exceed/i);
    expect(db.insert).not.toHaveBeenCalled();
  }, 30_000);
});
