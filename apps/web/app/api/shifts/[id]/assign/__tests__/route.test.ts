import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { validateAssignment } from "@/lib/scheduling/assignment-validator";
import { createNotification } from "@/lib/notifications";
import { chain, rejectingChain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/scheduling/assignment-validator", () => ({ validateAssignment: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const employeeUser = { id: "u2", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(method: string, body?: unknown) {
  return new Request("http://test", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

const futureShift = { shift: { id: "s1", startTime: new Date(Date.now() + 86400000) }, branch: { id: "b1", timezone: "UTC" } };

describe("GET /api/shifts/[id]/assign", () => {
  beforeEach(() => vi.resetAllMocks());

  it("hides assignments for unpublished shifts from employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ shift: { id: "s1", isPublished: false }, branch: { id: "b1" } }]));
    const res = await GET(req("GET"), params("s1"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/shifts/[id]/assign", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    const res = await POST(req("POST", { employeeId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(403);
  });

  it("locks assignment on a past shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date("2020-01-01T00:00:00Z") }, branch: { id: "b1" } }])
    );
    const res = await POST(req("POST", { employeeId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(409);
  });

  it("rejects an assignment that fails validation (e.g. outside availability)", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([futureShift]))
      .mockReturnValueOnce(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (validateAssignment as any).mockResolvedValue({ ok: false, message: "Outside availability", code: "UNAVAILABLE" });
    const res = await POST(req("POST", { employeeId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(409);
  });

  it("assigns the employee and sends a notification", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([futureShift]))
      .mockReturnValueOnce(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (validateAssignment as any).mockResolvedValue({ ok: true });
    (db.insert as any).mockReturnValue(chain([{ id: "assignment-1" }]));
    const res = await POST(req("POST", { employeeId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(201);
    expect(createNotification).toHaveBeenCalled();
  });

  it("returns a friendly 409 on a concurrent duplicate-assignment race", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any)
      .mockReturnValueOnce(chain([futureShift]))
      .mockReturnValueOnce(chain([{ id: "emp-1", organizationId: "org-1", branchId: "b1" }]));
    (validateAssignment as any).mockResolvedValue({ ok: true });
    (db.insert as any).mockReturnValue(rejectingChain({ code: "23505" }));
    const res = await POST(req("POST", { employeeId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("DUPLICATE_ASSIGNMENT");
  });
});

describe("DELETE /api/shifts/[id]/assign", () => {
  beforeEach(() => vi.resetAllMocks());

  it("locks unassignment on a past shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(
      chain([{ shift: { id: "s1", startTime: new Date("2020-01-01T00:00:00Z") }, branch: { id: "b1" } }])
    );
    const res = await DELETE(req("DELETE", { assignmentId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(409);
  });

  it("unassigns on a future shift", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([futureShift]));
    (db.delete as any).mockReturnValue(chain([]));
    const res = await DELETE(req("DELETE", { assignmentId: "550e8400-e29b-41d4-a716-446655440000" }), params("s1"));
    expect(res.status).toBe(204);
  });
});
