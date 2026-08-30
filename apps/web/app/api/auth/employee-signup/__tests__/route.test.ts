import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { BRANDS } from "@/lib/brand";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/send-confirmation-email", () => ({ sendConfirmationEmail: vi.fn() }));

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const client = {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { action_link: "http://test/confirm" } },
          error: null,
        }),
        ...overrides,
      },
    },
  };
  (createAdminClient as any).mockReturnValue(client);
  return client;
}

describe("POST /api/auth/employee-signup", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects an invalid payload", async () => {
    const res = await POST(req({ email: "not-an-email", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("refuses signup when no invite exists for the email", async () => {
    (db.select as any).mockReturnValue(chain([]));
    const res = await POST(req({ email: "nobody@x.com", password: "password123" }));
    expect(res.status).toBe(403);
  });

  it("tells an already-linked employee to log in instead", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", organizationId: "org-1", name: "Jane", role: "employee", branchId: null, authUserId: "existing-auth" }])
    );
    const res = await POST(req({ email: "jane@x.com", password: "password123" }));
    expect(res.status).toBe(400);
  });

  it("creates the auth user, links it, and sends confirmation email", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", organizationId: "org-1", name: "Jane", role: "employee", branchId: "b1", authUserId: null }])
    );
    (db.update as any).mockReturnValue(chain([]));
    mockSupabase();

    const res = await POST(req({ email: "jane@x.com", password: "password123" }));
    expect(res.status).toBe(201);
    expect(db.update).toHaveBeenCalled();
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      "jane@x.com",
      "http://test/confirm",
      "Jane",
      BRANDS.workplix
    );
  });

  it("does not enumerate existing auth users on createUser failure", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", organizationId: "org-1", name: "Jane", role: "employee", branchId: null, authUserId: null }])
    );
    mockSupabase({ createUser: vi.fn().mockResolvedValue({ data: null, error: { message: "already exists" } }) });

    const res = await POST(req({ email: "jane@x.com", password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).not.toMatch(/already exists/i);
  });
});
