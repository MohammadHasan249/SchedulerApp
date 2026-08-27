import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { pinCollidesWithExisting } from "@/lib/employees";
import { sendEmployeeInvitationEmail } from "@/lib/email/send-employee-invitation";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/employees", () => ({ pinCollidesWithExisting: vi.fn() }));
vi.mock("@/lib/email/send-employee-invitation", () => ({ sendEmployeeInvitationEmail: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employeeUser = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: null };

function getReq(url = "http://test/api/employees") {
  return new Request(url);
}
function postReq(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

describe("GET /api/employees", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns an empty page for a branch manager with no branch", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u4", role: "branch_manager", organizationId: "org-1", branchId: null });
    const res = await GET(getReq());
    expect(await res.json()).toEqual({ data: [], nextCursor: null });
  });

  it("scopes an employee's view to only their own record", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const self = [{ id: "emp-self", authUserId: "u3" }];
    (db.select as any).mockReturnValue(chain(self));
    const res = await GET(getReq());
    expect(await res.json()).toEqual({ data: self, nextCursor: null });
  });

  it("lists org employees for an admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const rows = [{ id: "e1" }, { id: "e2" }];
    (db.select as any).mockReturnValue(chain(rows));
    const res = await GET(getReq());
    expect(await res.json()).toEqual({ data: rows, nextCursor: null });
  });
});

describe("POST /api/employees (invite)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from inviting", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(postReq({ name: "New", email: "new@x.com" }));
    expect(res.status).toBe(403);
  });

  it("forbids a branch_manager from inviting a non-employee role", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "branch_manager" }));
    expect(res.status).toBe(403);
  });

  it("forbids a branch_manager from creating an org_admin", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "org_admin" }));
    expect(res.status).toBe(403);
  });

  it("rejects a PIN collision", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (pinCollidesWithExisting as any).mockResolvedValue(true);
    const res = await POST(postReq({ name: "New", email: "new@x.com", pin: "1234" }));
    expect(res.status).toBe(409);
  });

  it("creates the employee and sends the invite email", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (pinCollidesWithExisting as any).mockResolvedValue(false);
    const created = { id: "emp-new", name: "New", email: "new@x.com" };
    (db.insert as any).mockReturnValue(chain([created]));
    (sendEmployeeInvitationEmail as any).mockResolvedValue({ sent: true });

    const res = await POST(postReq({ name: "New", email: "new@x.com" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...created, emailSent: true });
  });
});
