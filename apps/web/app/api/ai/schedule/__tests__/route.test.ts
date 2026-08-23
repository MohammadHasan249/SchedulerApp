import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/scheduling/assignment-validator", () => ({ validateAssignment: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const validBody = { messages: [{ role: "user" as const, content: "Fill next week's shifts" }] };

function mockDeepSeekReply(content: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
    }),
  }) as any;
}

describe("POST /api/ai/schedule", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DEEPSEEK_API_KEY = "test-key";
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("forbids employees from using the scheduling assistant", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 503 when DeepSeek is not configured", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    delete process.env.DEEPSEEK_API_KEY;
    const res = await POST(req(validBody));
    expect(res.status).toBe(503);
  });

  it("rate limits by organization", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (checkRateLimit as any).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
  });

  it("rejects a malformed payload", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(req({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 504 when DeepSeek times out", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    global.fetch = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")) as any;
    const res = await POST(req(validBody));
    expect(res.status).toBe(504);
  });

  it("returns 500 when DeepSeek responds with an error status", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "boom" }) as any;
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
  });

  it("returns the assistant's reply when no tool calls are made", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    mockDeepSeekReply("Here is the schedule summary.");
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Here is the schedule summary." });
  });

  it("runs assign_employee via the tool loop and returns the follow-up reply", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }])) // getScopedBranchIds
      .mockReturnValueOnce(chain([{ id: "shift-1", branchId: "b1", startTime: new Date("2024-01-01T09:00:00Z"), endTime: new Date("2024-01-01T13:00:00Z") }])) // shift lookup
      .mockReturnValueOnce(chain([{ id: "emp-1" }])) // employee lookup
      .mockReturnValueOnce(chain([{ timezone: "UTC" }])); // branch timezone
    (validateAssignment as any).mockResolvedValue({ ok: true });
    (db.insert as any).mockReturnValue(chain([{ id: "assignment-1" }]));
    (createNotification as any).mockResolvedValue(undefined);

    let call = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call-1",
                      type: "function",
                      function: { name: "assign_employee", arguments: JSON.stringify({ shiftId: "shift-1", employeeId: "emp-1" }) },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Assigned emp-1 to the shift." } }] }),
      };
    }) as any;

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "Assigned emp-1 to the shift." });
    expect(createNotification).toHaveBeenCalled();
  });

  it("feeds a tool error back to the model instead of crashing on malformed tool arguments", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    let call = 0;
    let secondCallMessages: unknown[] = [];
    global.fetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      call += 1;
      if (call === 1) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    { id: "call-1", type: "function", function: { name: "assign_employee", arguments: "{not json" } },
                  ],
                },
              },
            ],
          }),
        };
      }
      secondCallMessages = JSON.parse(init.body).messages;
      return {
        ok: true,
        json: async () => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }] }),
      };
    }) as any;

    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const toolMsg = secondCallMessages.find((m: any) => m.role === "tool");
    expect(JSON.parse((toolMsg as any).content).error).toMatch(/malformed JSON/i);
  });
});
