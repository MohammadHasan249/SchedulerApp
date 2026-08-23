import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const manager = { id: "u1", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/job-roles", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists job roles for the org", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const rows = [{ id: "jr1", name: "Cook" }];
    (db.select as any).mockReturnValue(chain(rows));
    const res = await GET();
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/job-roles", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from creating job roles", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(req({ name: "Cook" }));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid payload", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(req({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("allows a branch_manager to create a job role", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const created = { id: "jr1", name: "Cook" };
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(req({ name: "Cook" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });
});
