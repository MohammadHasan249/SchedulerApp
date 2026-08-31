import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { sendTimeOffNotification } from "@/lib/email/send-time-off-notification";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({
  getApiUser: vi.fn(),
  ApiAuthError: class ApiAuthError extends Error {},
}));
vi.mock("@/lib/email/send-time-off-notification", () => ({ sendTimeOffNotification: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const future = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86400000).toISOString().split("T")[0];

describe("GET /api/time-off", () => {
  beforeEach(() => vi.resetAllMocks());

  it("scopes an employee's view to their own requests", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const rows = [{ id: "req-1" }];
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/time-off", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the caller has no employee profile", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(req({ startDate: future(1), endDate: future(2) }));
    expect(res.status).toBe(404);
  });

  it("rejects startDate after endDate", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    const res = await POST(req({ startDate: future(5), endDate: future(1) }));
    expect(res.status).toBe(400);
  });

  it("rejects a request in the past", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    const res = await POST(req({ startDate: "2020-01-01", endDate: "2020-01-02" }));
    expect(res.status).toBe(400);
  });

  it("rejects a request exceeding the max duration", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    const res = await POST(req({ startDate: future(1), endDate: future(200) }));
    expect(res.status).toBe(400);
  });

  it("rejects overlap with an existing non-denied request", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ id: "existing-req" }]));
    const res = await POST(req({ startDate: future(1), endDate: future(3) }));
    expect(res.status).toBe(409);
  });

  it("creates the request and sends a notification email", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([]));
    const created = { id: "req-1" };
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(req({ startDate: future(1), endDate: future(3) }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(sendTimeOffNotification).toHaveBeenCalled();
  });
});
