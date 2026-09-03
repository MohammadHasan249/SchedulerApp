import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employee = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: "b1" };

function req(body?: unknown) {
  return new Request("http://test", { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/settings/hours", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns empty object when no hours are set", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});

describe("PUT /api/settings/hours", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employee);
    const res = await PUT(req({ "1": { startTime: "09:00", endTime: "17:00" } }));
    expect(res.status).toBe(403);
  });

  it("allows branch managers to save a valid schedule", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const saved = { "1": { startTime: "09:00", endTime: "17:00" } };
    (db.update as any).mockReturnValue(chain([{ hoursSchedule: saved }]));
    const res = await PUT(req(saved));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
  });

  it("rejects an invalid time value", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PUT(req({ "1": { startTime: "25:00", endTime: "17:00" } }));
    expect(res.status).toBe(400);
  });

  it("rejects startTime >= endTime", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PUT(req({ "1": { startTime: "17:00", endTime: "09:00" } }));
    expect(res.status).toBe(400);
  });

  it("saves a valid schedule", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const saved = { "1": { startTime: "09:00", endTime: "17:00" } };
    (db.update as any).mockReturnValue(chain([{ hoursSchedule: saved }]));
    const res = await PUT(req(saved));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
  });
});
