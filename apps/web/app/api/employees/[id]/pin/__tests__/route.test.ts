import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { pinCollidesWithExisting } from "@/lib/employees";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));
vi.mock("@/lib/employees", () => ({ pinCollidesWithExisting: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body?: unknown) {
  return new Request("http://test", { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PATCH /api/employees/[id]/pin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
  });

  it("rate limits repeated PIN changes", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (checkRateLimit as any).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    const res = await PATCH(req({ pin: "1234" }), params("emp-1"));
    expect(res.status).toBe(429);
  });

  it("forbids setting a PIN on another user's employee record", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req({ pin: "1234" }), params("someone-elses-id"));
    expect(res.status).toBe(403);
  });

  it("rejects a malformed PIN", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    const res = await PATCH(req({ pin: "12" }), params("emp-1"));
    expect(res.status).toBe(400);
  });

  it("rejects a colliding PIN", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (pinCollidesWithExisting as any).mockResolvedValue(true);
    const res = await PATCH(req({ pin: "1234" }), params("emp-1"));
    expect(res.status).toBe(409);
  });

  it("sets the PIN", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (pinCollidesWithExisting as any).mockResolvedValue(false);
    (db.update as any).mockReturnValue(chain([{ name: "Alice" }]));
    const res = await PATCH(req({ pin: "1234" }), params("emp-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, name: "Alice" });
  }, 10000);
});
