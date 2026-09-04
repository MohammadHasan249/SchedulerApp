import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req() {
  return new Request("http://test");
}

describe("GET /api/shifts/[id]/eligible-covers", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the shift isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValueOnce(chain([]));
    const res = await GET(req(), params("s1"));
    expect(res.status).toBe(404);
  });

  it("excludes the caller and returns active same-branch coworkers", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([{ shift: { id: "s1" }, branch: { id: "b1" } }])) // shift lookup
      .mockReturnValueOnce(chain([{ id: "emp-self" }])) // self lookup
      .mockReturnValueOnce(chain([{ id: "emp-2", name: "Coworker" }])); // eligible covers

    const res = await GET(req(), params("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "emp-2", name: "Coworker" }]);
  });
});
