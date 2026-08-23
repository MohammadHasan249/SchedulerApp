import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const params = (employeeId: string) => ({ params: Promise.resolve({ employeeId }) });

function req(body?: unknown) {
  return new Request("http://test", {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const orgAdmin = { id: "u1", email: "a@x.com", role: "org_admin" as const, organizationId: "org-1", branchId: null };

describe("GET /api/availability/[employeeId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the employee doesn't belong to the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));

    const res = await GET(req(), params("emp-1"));
    expect(res.status).toBe(404);
  });

  it("returns the availability schedule when access is verified", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1" }]))
      .mockReturnValueOnce(chain([{ availabilitySchedule: { "1": { startTime: "09:00", endTime: "17:00" } } }]));

    const res = await GET(req(), params("emp-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ "1": { startTime: "09:00", endTime: "17:00" } });
  });

  it("an employee cannot read another employee's availability", async () => {
    const employeeUser = { id: "u2", email: "e@x.com", role: "employee" as const, organizationId: "org-1", branchId: null };
    (getApiUser as any).mockResolvedValue(employeeUser);
    // verifyEmployeeAccess adds an authUserId filter — simulate no row matching
    (db.select as any).mockReturnValue(chain([]));

    const res = await GET(req(), params("someone-elses-id"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/availability/[employeeId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects a slot where startTime is not before endTime", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));

    const res = await PUT(req({ "1": { startTime: "17:00", endTime: "09:00" } }), params("emp-1"));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed payload", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));

    const res = await PUT(req({ "7": { startTime: "09:00", endTime: "17:00" } }), params("emp-1"));
    expect(res.status).toBe(400);
  });

  it("saves a valid schedule and returns it", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    const saved = { "1": { startTime: "09:00", endTime: "17:00" } };
    (db.update as any).mockReturnValue(chain([{ availabilitySchedule: saved }]));

    const res = await PUT(req(saved), params("emp-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
  });
});
