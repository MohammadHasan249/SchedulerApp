import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { validateAssignment } from "@/lib/scheduling/assignment-validator";
import { createNotification } from "@/lib/notifications";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/auth/getUser", () => ({
  getApiUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {},
}));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/scheduling/assignment-validator", () => ({ validateAssignment: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

// The route builds the real agent (`createScheduleAgent`) so its tool
// implementations run for real against the mocked db — only the model itself
// is swapped for a `MockLanguageModelV4` so tests stay deterministic and don't
// hit the AI Gateway. `setModel` is called per-test before POST() runs.
const { getModel, setModel } = vi.hoisted(() => {
  let model: unknown;
  return {
    getModel: () => model,
    setModel: (m: unknown) => {
      model = m;
    },
  };
});
vi.mock("@/lib/ai/schedule-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/schedule-agent")>();
  return {
    ...actual,
    createScheduleAgent: (user: Parameters<typeof actual.createScheduleAgent>[0]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actual.createScheduleAgent(user, getModel() as any),
  };
});

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textStep(text: string): any {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text },
        { type: "text-end", id: "t1" },
        { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
      ],
    }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toolCallStep(toolCallId: string, toolName: string, input: unknown): any {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) },
        { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USAGE },
      ],
    }),
  };
}

function userUiMessage(text: string) {
  return { id: `u-${text.slice(0, 8)}`, role: "user" as const, parts: [{ type: "text" as const, text }] };
}

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const validBody = { messages: [userUiMessage("Fill next week's shifts")] };

describe("POST /api/ai/schedule", () => {
  const originalKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AI_GATEWAY_API_KEY = "test-key";
    (checkRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    // Default branch-scope select for anything that doesn't set up its own chain
    // (e.g. the "today" branch-timezone lookup in the system prompt).
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain([]));
  });

  afterEach(() => {
    process.env.AI_GATEWAY_API_KEY = originalKey;
  });

  it("forbids employees from using the scheduling assistant", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(employeeUser);
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 503 when the AI Gateway is not configured", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    delete process.env.AI_GATEWAY_API_KEY;
    const res = await POST(req(validBody));
    expect(res.status).toBe(503);
  });

  it("rate limits by organization", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    (checkRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
  });

  it("rejects a malformed payload", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("streams the assistant's reply when no tool calls are made", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    setModel(new MockLanguageModelV4({ doStream: [textStep("Here is the schedule summary.")] }));

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Here is the schedule summary.");
  });

  it("only sends the last 6 messages to the model, dropping older history", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    const model = new MockLanguageModelV4({ doStream: [textStep("ok")] });
    setModel(model);

    const longHistory = Array.from({ length: 9 }, (_, i) => userUiMessage(`msg ${i}`));
    const res = await POST(req({ messages: longHistory }));
    await res.text(); // force the (lazily-pulled) stream to actually run the model call

    const call = model.doStreamCalls[0];
    // The model call's prompt is [system instructions, ...trimmed history] —
    // 1 system message + the last 6 (of 9) user messages.
    const promptMessages = (call as { prompt?: unknown[] }).prompt ?? [];
    expect(promptMessages.length).toBe(7);
  });

  // assign_employee only accepts opaque handles (e.g. "shift_1"), never real
  // DB IDs — the model must call list_shifts/list_employees first to obtain
  // them. These mocks stand in for that resolution sequence.
  function mockListAndAssignDbCalls() {
    (db.select as unknown as ReturnType<typeof vi.fn>)
      // system prompt: getScopedBranchIds + branch timezone (caches "b1" -> UTC
      // for the rest of the request, via the shared branchTimezoneCache)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(chain([{ timezone: "UTC" }]))
      // list_shifts: getScopedBranchIds, shiftRows, assignmentRows (per-shift
      // timezone lookup hits the cache from above, no DB call)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(
        chain([
          {
            id: "shift-1",
            branchId: "b1",
            startTime: new Date("2024-01-01T09:00:00Z"),
            endTime: new Date("2024-01-01T13:00:00Z"),
            isPublished: false,
          },
        ])
      )
      .mockReturnValueOnce(chain([]))
      // list_employees: employee rows, jobRoles rows, getScopedBranchIds (week
      // hours), weekAssignments (branch timezone for the week-hours loop also
      // hits the cache, no DB call)
      .mockReturnValueOnce(
        chain([{ id: "emp-1", name: "Emp One", jobRoleId: null, maxHoursPerWeek: 40, availabilitySchedule: null }])
      )
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(chain([]))
      // assign_employee: getScopedBranchIds, shift lookup, employee lookup,
      // branch timezone (this one is a direct select, not the cached helper)
      .mockReturnValueOnce(chain([{ id: "b1" }]))
      .mockReturnValueOnce(
        chain([
          {
            id: "shift-1",
            branchId: "b1",
            startTime: new Date("2024-01-01T09:00:00Z"),
            endTime: new Date("2024-01-01T13:00:00Z"),
          },
        ])
      )
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ timezone: "UTC" }]));
  }

  it("runs assign_employee via the tool loop and streams the follow-up reply", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockListAndAssignDbCalls();
    (validateAssignment as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const valuesSpy = vi.fn().mockReturnValue(chain([{ id: "assignment-1" }]));
    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesSpy });
    (createNotification as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    setModel(
      new MockLanguageModelV4({
        doStream: [
          toolCallStep("c1", "list_shifts", {}),
          toolCallStep("c2", "list_employees", {}),
          toolCallStep("call-1", "assign_employee", { shiftId: "shift_1", employeeId: "employee_1" }),
          textStep("Assigned Emp One to the shift."),
        ],
      })
    );

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Assigned Emp One to the shift.");
    expect(createNotification).toHaveBeenCalled();
    expect(valuesSpy).toHaveBeenCalledWith({
      shiftId: "shift-1",
      employeeId: "emp-1",
      jobRoleId: null,
    });
  });

  it("rejects an assign_employee call that uses a raw DB ID instead of a resolved handle", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain([{ id: "b1" }]));

    setModel(
      new MockLanguageModelV4({
        doStream: [toolCallStep("call-1", "assign_employee", { shiftId: "shift-1", employeeId: "emp-1" }), textStep("ok")],
      })
    );

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(db.insert).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).toMatch(/not found/i);
  });

  it("does not insert an assignment when validateAssignment rejects it", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    mockListAndAssignDbCalls();
    (validateAssignment as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      message: "Employee is unavailable that day.",
    });

    setModel(
      new MockLanguageModelV4({
        doStream: [
          toolCallStep("c1", "list_shifts", {}),
          toolCallStep("c2", "list_employees", {}),
          toolCallStep("call-1", "assign_employee", { shiftId: "shift_1", employeeId: "employee_1" }),
          textStep("Can't assign — unavailable."),
        ],
      })
    );

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Can't assign — unavailable.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a shift via create_shift, converting the model's local wall-clock time using the branch timezone", async () => {
    (getApiUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(orgAdmin);
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain([{ id: "b1" }]));
    const valuesSpy = vi.fn().mockReturnValue(chain([{ id: "new-shift-1" }]));
    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesSpy });

    setModel(
      new MockLanguageModelV4({
        doStream: [
          toolCallStep("call-1", "create_shift", { startTime: "2024-01-01T09:00:00", endTime: "2024-01-01T13:00:00" }),
          textStep("Created the shift."),
        ],
      })
    );

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Created the shift.");
    // Branch timezone resolves to UTC via the blanket db.select mock, so the
    // local-time input converts 1:1 to the same UTC instant.
    expect(valuesSpy).toHaveBeenCalledWith({
      branchId: "b1",
      startTime: new Date("2024-01-01T09:00:00Z"),
      endTime: new Date("2024-01-01T13:00:00Z"),
      isPublished: false,
    });
    // The tool result handed back to the model must not contain the raw DB ID.
    expect(text).not.toContain("new-shift-1");
  });
});
