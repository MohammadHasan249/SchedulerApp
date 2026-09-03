import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { BRANDS } from "@/lib/brand";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/send-confirmation-email", () => ({ sendConfirmationEmail: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

function mockSupabase(overrides: Record<string, unknown> = {}, authOverrides: Record<string, unknown> = {}) {
  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid" } }),
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null }),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { hashed_token: "tok123" } },
          error: null,
        }),
        ...overrides,
      },
      ...authOverrides,
    },
  };
  (createAdminClient as any).mockReturnValue(client);
  return client;
}

describe("POST /api/auth/employee-signup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
    (getClientIp as any).mockReturnValue("test-ip");
  });

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
      `${BRANDS.workplix.appUrl}/confirmed?token_hash=tok123&type=signup`,
      "Jane",
      BRANDS.workplix
    );
  });

  it("does not leak Supabase's internal error when createUser fails and the password doesn't match", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-1", organizationId: "org-1", name: "Jane", role: "employee", branchId: null, authUserId: null }])
    );
    mockSupabase({ createUser: vi.fn().mockResolvedValue({ data: null, error: { message: "some internal supabase detail" } }) });

    const res = await POST(req({ email: "jane@x.com", password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).not.toMatch(/internal supabase detail/i);
  });

  it("links an existing auth account (from another org) when the submitted password matches it", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "emp-2", organizationId: "org-2", name: "Jane", role: "employee", branchId: "b1", authUserId: null }])
    );
    (db.update as any).mockReturnValue(chain([]));
    mockSupabase(
      { createUser: vi.fn().mockResolvedValue({ data: null, error: { message: "already exists" } }) },
      { signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "existing-auth" } }, error: null }) }
    );

    const res = await POST(req({ email: "jane@x.com", password: "password123" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ success: true, linked: true });
    expect(db.update).toHaveBeenCalled();
    expect(sendConfirmationEmail).not.toHaveBeenCalled();
  });
});
