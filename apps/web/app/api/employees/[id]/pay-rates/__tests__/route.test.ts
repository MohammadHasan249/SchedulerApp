import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { userHasPermission } from "@/lib/auth/permissions";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ userHasPermission: vi.fn() }));

const manager = { id: "u1", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown) {
  return new Request("http://test", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/employees/[id]/pay-rates", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees outright", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await GET(req("GET"), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("forbids a manager without the salaries:view permission", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(false);
    const res = await GET(req("GET"), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("404s when the employee is out of the manager's branch scope", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(true);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "other-branch" }]));
    const res = await GET(req("GET"), params("emp-1"));
    expect(res.status).toBe(404);
  });

  it("returns pay rate history when permitted", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(true);
    const rows = [{ id: "pr1", amountCents: 2000 }];
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]))
      .mockReturnValueOnce(chain(rows));
    const res = await GET(req("GET"), params("emp-1"));
    expect(await res.json()).toEqual(rows);
  });
});

describe("POST /api/employees/[id]/pay-rates", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids a manager without salaries:edit", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(false);
    const res = await POST(req("POST", { payType: "hourly", amountCents: 2000, effectiveDate: "2024-01-01" }), params("emp-1"));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid payload", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(true);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    const res = await POST(req("POST", { payType: "hourly", amountCents: -5, effectiveDate: "2024-01-01" }), params("emp-1"));
    expect(res.status).toBe(400);
  });

  it("creates a pay rate entry attributed to the acting employee", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (userHasPermission as any).mockResolvedValue(true);
    const created = { id: "pr1", amountCents: 2000 };
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]))
      .mockReturnValueOnce(chain([{ id: "actor-emp" }]));
    (db.insert as any).mockReturnValue(chain([created]));
    const res = await POST(
      req("POST", { payType: "hourly", amountCents: 2000, effectiveDate: "2024-01-01" }),
      params("emp-1")
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
  });
});
