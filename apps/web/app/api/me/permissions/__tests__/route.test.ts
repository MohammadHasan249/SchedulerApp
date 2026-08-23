import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

describe("GET /api/me/permissions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("grants org_admin every permission without hitting the db", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u1", role: "org_admin", organizationId: "org-1", branchId: null });
    const res = await GET();
    const body = await res.json();
    expect(body.permissions).toContain("salaries:view");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns exactly the profile's permissions for a non-admin", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u2", role: "branch_manager", organizationId: "org-1", branchId: "b1" });
    (db.select as any).mockReturnValue(chain([{ permissions: ["salaries:view"] }]));
    const res = await GET();
    expect(await res.json()).toEqual({ permissions: ["salaries:view"] });
  });

  it("returns no permissions when the caller has no profile", async () => {
    (getApiUser as any).mockResolvedValue({ id: "u3", role: "employee", organizationId: "org-1", branchId: null });
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET();
    expect(await res.json()).toEqual({ permissions: [] });
  });
});
