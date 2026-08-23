import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { createNotifications } from "@/lib/notifications";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn(), transaction: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn() }));

const employeeUser = { id: "u1", role: "employee" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function req(body?: unknown) {
  return new Request("http://test", { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
}

const pendingSwapRow = {
  swap: { id: "swap-1", status: "pending", requesterId: "emp-req", coverId: null },
  requester: { id: "emp-req" },
  shift: { id: "shift-1" },
  branch: { id: "b1" },
};

describe("PATCH /api/shift-swaps/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("404s when the swap isn't in the caller's org", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([]));
    const res = await PATCH(req({ action: "accept_cover" }), params("swap-1"));
    expect(res.status).toBe(404);
  });

  it("rejects an invalid action", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any).mockReturnValue(chain([pendingSwapRow]));
    const res = await PATCH(req({ action: "bogus" }), params("swap-1"));
    expect(res.status).toBe(400);
  });

  it("accept_cover: rejects covering your own swap request", async () => {
    (getApiUser as any).mockResolvedValue({ ...employeeUser, id: "u-req" });
    (db.select as any)
      .mockReturnValueOnce(chain([pendingSwapRow]))
      .mockReturnValueOnce(chain([{ id: "emp-req", branchId: "b1" }]));
    const res = await PATCH(req({ action: "accept_cover" }), params("swap-1"));
    expect(res.status).toBe(409);
  });

  it("accept_cover: succeeds and notifies the requester", async () => {
    (getApiUser as any).mockResolvedValue(employeeUser);
    (db.select as any)
      .mockReturnValueOnce(chain([pendingSwapRow]))
      .mockReturnValueOnce(chain([{ id: "emp-cover", branchId: "b1", name: "Bob" }]));
    (db.update as any).mockReturnValue(chain([{ id: "swap-1", requesterId: "emp-req", status: "cover_accepted" }]));
    const res = await PATCH(req({ action: "accept_cover" }), params("swap-1"));
    expect(res.status).toBe(200);
    expect(createNotifications).toHaveBeenCalled();
  });

  it("manager_approve: forbids a branch_manager outside the shift's branch", async () => {
    (getApiUser as any).mockResolvedValue({ ...manager, branchId: "other-branch" });
    (db.select as any).mockReturnValue(chain([pendingSwapRow]));
    const res = await PATCH(req({ action: "manager_approve" }), params("swap-1"));
    expect(res.status).toBe(403);
  });

  it("manager_approve: rejects when cover hasn't accepted yet", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any).mockReturnValue(chain([pendingSwapRow]));
    const res = await PATCH(req({ action: "manager_approve" }), params("swap-1"));
    expect(res.status).toBe(409);
  });

  it("deny: updates status and notifies both parties", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any)
      .mockReturnValueOnce(chain([pendingSwapRow]))
      .mockReturnValueOnce(chain([{ id: "manager-emp" }]));
    (db.update as any).mockReturnValue(chain([{ id: "swap-1", requesterId: "emp-req", coverId: "emp-cover", status: "denied" }]));
    const res = await PATCH(req({ action: "deny" }), params("swap-1"));
    expect(res.status).toBe(200);
    expect(createNotifications).toHaveBeenCalled();
  });

  it("manager_approve: performs the swap atomically and notifies both parties", async () => {
    const acceptedSwapRow = {
      swap: { id: "swap-1", status: "cover_accepted", requesterId: "emp-req", coverId: "emp-cover" },
      requester: { id: "emp-req" },
      shift: { id: "shift-1" },
      branch: { id: "b1" },
    };
    (getApiUser as any).mockResolvedValue(manager);
    (db.select as any)
      .mockReturnValueOnce(chain([acceptedSwapRow])) // getSwap
      .mockReturnValueOnce(chain([{ id: "manager-emp" }])) // managerEmp lookup
      .mockReturnValueOnce(chain([])); // coverAlreadyAssigned check

    (db.transaction as any).mockImplementation(async (cb: any) =>
      cb({
        select: () => chain([{ id: "assignment-1", jobRoleId: null }]),
        delete: () => chain([]),
        insert: () => chain([]),
        update: () => chain([{ id: "swap-1", requesterId: "emp-req", coverId: "emp-cover", status: "manager_approved" }]),
      })
    );

    const res = await PATCH(req({ action: "manager_approve" }), params("swap-1"));
    expect(res.status).toBe(200);
    expect(createNotifications).toHaveBeenCalled();
  });
});
