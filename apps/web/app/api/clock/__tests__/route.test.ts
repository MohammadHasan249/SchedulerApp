import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { chain } from "@/test/db-mock";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };

function getReq(url = "http://test/api/clock") {
  return new Request(url);
}
function postReq(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/clock", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from viewing clock history", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
  });

  it("returns an empty page for a branch manager with no branch", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u3", role: "branch_manager", organizationId: "org-1", branchId: null });
    const res = await GET(getReq());
    expect(await res.json()).toEqual({ data: [], nextCursor: null });
  });

  it("paginates using cursor and reports nextCursor when more rows exist", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1" }])) // branches for org
      .mockReturnValueOnce(
        chain(
          Array.from({ length: 3 }, (_, i) => ({
            event: { timestamp: new Date(`2024-01-0${i + 1}T00:00:00Z`) },
            employee: { id: `e${i}` },
          }))
        )
      );
    const res = await GET(getReq("http://test/api/clock?limit=2"));
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).toBeTruthy();
  });
});

describe("POST /api/clock (kiosk clock-in)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rate limits repeated attempts per IP+branch", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: false, resetAt: Date.now() + 60_000 });
    const res = await POST(postReq({ pin: "1234", branchSlug: "main" }));
    expect(res.status).toBe(429);
  });

  it("404s when the branch slug doesn't exist", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(postReq({ pin: "1234", branchSlug: "nope" }));
    expect(res.status).toBe(404);
  });

  it("rejects an invalid PIN", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1", organizationId: "org-1", slug: "main", timezone: "UTC" }]))
      .mockReturnValueOnce(chain([]));
    const res = await POST(postReq({ pin: "0000", branchSlug: "main" }));
    expect(res.status).toBe(401);
  }, 10000);

  it("refuses to clock in when the PIN matches multiple employees (collision)", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("1234", 10);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1", organizationId: "org-1", slug: "main", timezone: "UTC" }]))
      .mockReturnValueOnce(
        chain([
          { id: "e1", name: "A", branchId: "b1", role: "employee", pinHash: hash },
          { id: "e2", name: "B", branchId: "b1", role: "employee", pinHash: hash },
        ])
      );
    const res = await POST(postReq({ pin: "1234", branchSlug: "main" }));
    expect(res.status).toBe(409);
  }, 10000);

  it("clocks a matched employee in when no prior event exists today", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("1234", 10);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1", organizationId: "org-1", slug: "main", timezone: "UTC" }]))
      .mockReturnValueOnce(chain([{ id: "e1", name: "Alice", branchId: "b1", role: "employee", pinHash: hash }]))
      .mockReturnValueOnce(chain([])); // no lastEvent today
    (db.insert as any).mockReturnValue(chain([{ timestamp: new Date("2024-01-01T09:00:00Z") }]));

    const res = await POST(postReq({ pin: "1234", branchSlug: "main" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ employeeName: "Alice", clockType: "clock_in" });
  }, 10000);

  it("toggles to clock_out when the employee's last event today was a clock_in", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    const hash = await bcrypt.hash("1234", 10);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "b1", organizationId: "org-1", slug: "main", timezone: "UTC" }]))
      .mockReturnValueOnce(chain([{ id: "e1", name: "Alice", branchId: "b1", role: "employee", pinHash: hash }]))
      .mockReturnValueOnce(chain([{ type: "clock_in" }]));
    (db.insert as any).mockReturnValue(chain([{ timestamp: new Date("2024-01-01T17:00:00Z") }]));

    const res = await POST(postReq({ pin: "1234", branchSlug: "main" }));
    const body = await res.json();
    expect(body.clockType).toBe("clock_out");
  }, 10000);
});
