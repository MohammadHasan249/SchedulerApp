import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { generateUniquePin, unbanAuthUser, withPinLock } from "@/lib/employees";
import { sendEmployeeInvitationEmail } from "@/lib/email/send-employee-invitation";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
// withPinLock just runs its callback with the (mocked) db in place of a real
// tx — these tests don't exercise real transaction/locking semantics.
vi.mock("@/lib/employees", async () => {
  const { db } = await import("@/lib/db");
  return {
    generateUniquePin: vi.fn(),
    unbanAuthUser: vi.fn(),
    withPinLock: vi.fn((_organizationId: string, fn: (tx: typeof db) => unknown) => fn(db)),
  };
});
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
  beforeEach(() => {
    vi.resetAllMocks();
    // resetAllMocks clears the passthrough implementation set in the factory
    // above too, so it needs to be re-established here each time.
    (withPinLock as any).mockImplementation((_organizationId: string, fn: (tx: typeof db) => unknown) => fn(db));
  });

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

  it("forbids inviting an org_admin, even by another org_admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "org_admin" }));
    expect(res.status).toBe(403);
  });

  it("creates the employee with an auto-generated PIN and sends the invite email", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (generateUniquePin as any).mockResolvedValue("4321");
    const created = { id: "emp-new", name: "New", email: "new@x.com" };
    const branchId = "11111111-1111-4111-8111-111111111111";
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: branchId }])) // branch ownership check
      .mockReturnValueOnce(chain([])); // no existing employee row for this email
    (db.insert as any).mockReturnValue(chain([created]));
    (sendEmployeeInvitationEmail as any).mockResolvedValue({ sent: true });

    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "branch_manager", branchId }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...created, emailSent: true });
    expect(sendEmployeeInvitationEmail).toHaveBeenCalledWith("New", "new@x.com", "org-1", "4321");
  });

  it("rejects re-inviting an email that's already an active employee here", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const branchId = "11111111-1111-4111-8111-111111111111";
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: branchId }])) // branch ownership check
      .mockReturnValueOnce(chain([{ id: "emp-existing", isActive: true, authUserId: null }]));

    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "branch_manager", branchId }));
    expect(res.status).toBe(409);
  });

  it("reactivates a previously deactivated employee instead of inserting a duplicate row", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (generateUniquePin as any).mockResolvedValue("9999");
    const branchId = "11111111-1111-4111-8111-111111111111";
    const reactivated = { id: "emp-old", name: "New", email: "new@x.com", isActive: true };
    (db.select as any)
      .mockReturnValueOnce(chain([{ id: branchId }])) // branch ownership check
      .mockReturnValueOnce(chain([{ id: "emp-old", isActive: false, authUserId: "auth-old" }]));
    (db.update as any).mockReturnValue(chain([reactivated]));
    (sendEmployeeInvitationEmail as any).mockResolvedValue({ sent: true });

    const res = await POST(postReq({ name: "New", email: "new@x.com", role: "branch_manager", branchId }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ...reactivated, emailSent: true });
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(unbanAuthUser).toHaveBeenCalledWith("auth-old");
  });
});
