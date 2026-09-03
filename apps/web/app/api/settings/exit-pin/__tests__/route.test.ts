import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { chain } from "@/test/db-mock";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({ db: { update: vi.fn(), select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employee = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: "b1" };

function req(body?: unknown) {
  return new Request("http://test", { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("PUT /api/settings/exit-pin", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids non-admins from setting the exit pin", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await PUT(req({ pin: "1234" }));
    expect(res.status).toBe(403);
  });

  it("rejects a malformed pin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PUT(req({ pin: "12" }));
    expect(res.status).toBe(400);
  });

  it("hashes and saves a valid pin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.update as any).mockReturnValue(chain([]));
    const res = await PUT(req({ pin: "1234" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/settings/exit-pin (verify)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from verifying the exit pin", async () => {
    (getApiUser as any).mockResolvedValue(employee);
    const res = await POST(req({ pin: "1234" }));
    expect(res.status).toBe(403);
  });

  it("allows branch managers to verify the exit pin", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("5678", 10);
    (db.select as any).mockReturnValue(chain([{ exitPinHash: hash }]));
    const res = await POST(req({ pin: "5678" }));
    expect(await res.json()).toEqual({ valid: true, configured: true });
  }, 10000);

  it("rate limits repeated attempts", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (checkRateLimit as any).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    const res = await POST(req({ pin: "1234" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns configured:false when no pin has been set", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (db.select as any).mockReturnValue(chain([{ exitPinHash: null }]));
    const res = await POST(req({ pin: "1234" }));
    expect(await res.json()).toEqual({ valid: false, configured: false });
  }, 10000);

  it("validates a correct pin against the stored hash", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("5678", 10);
    (db.select as any).mockReturnValue(chain([{ exitPinHash: hash }]));
    const res = await POST(req({ pin: "5678" }));
    expect(await res.json()).toEqual({ valid: true, configured: true });
  }, 10000);

  it("rejects an incorrect pin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("5678", 10);
    (db.select as any).mockReturnValue(chain([{ exitPinHash: hash }]));
    const res = await POST(req({ pin: "0000" }));
    expect(await res.json()).toEqual({ valid: false, configured: true });
  }, 10000);
});
