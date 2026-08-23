import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test", { method: "PATCH" });

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the caller has no employee row", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req(), params("n1"));
    expect(res.status).toBe(404);
  });

  it("404s when the notification doesn't belong to the caller (can't mark others' notifications read)", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    (db.update as any).mockReturnValue(chain([]));
    const res = await PATCH(req(), params("someone-elses-notification"));
    expect(res.status).toBe(404);
  });

  it("marks the notification read", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([{ id: "emp-1" }]));
    (db.update as any).mockReturnValue(chain([{ id: "n1", isRead: true }]));
    const res = await PATCH(req(), params("n1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "n1", isRead: true });
  });
});
