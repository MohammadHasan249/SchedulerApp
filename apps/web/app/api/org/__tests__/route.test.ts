import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { db } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmationEmail } from "@/lib/email/send-confirmation-email";
import { BRANDS } from "@/lib/brand";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), transaction: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/send-confirmation-email", () => ({ sendConfirmationEmail: vi.fn() }));

function req(body?: unknown) {
  return new Request("http://test", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

const validPayload = {
  orgName: "Acme Co",
  orgSlug: "acme-co",
  industry: "restaurant" as const,
  fullName: "Jane Admin",
  email: "jane@acme.com",
  password: "supersecret",
};

function mockSupabase(overrides: Partial<ReturnType<typeof baseSupabase>> = {}) {
  const client = { ...baseSupabase(), ...overrides };
  (createAdminClient as any).mockReturnValue(client);
  return client;
}

function baseSupabase() {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null }),
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        deleteUser: vi.fn().mockResolvedValue({}),
        generateLink: vi.fn().mockResolvedValue({
          data: { properties: { hashed_token: "tok123" } },
          error: null,
        }),
      },
    },
  };
}

describe("POST /api/org (create organization)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects an invalid payload", async () => {
    const res = await POST(req({ orgName: "A" }));
    expect(res.status).toBe(400);
  });

  it("rejects a slug that's already taken", async () => {
    (db.select as any).mockReturnValue(chain([{ id: "existing-org" }]));
    const res = await POST(req(validPayload));
    expect(res.status).toBe(409);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rolls back the orphan auth user if the DB transaction fails", async () => {
    (db.select as any).mockReturnValue(chain([]));
    const supabase = mockSupabase();
    (db.transaction as any).mockRejectedValue(new Error("db down"));

    const res = await POST(req(validPayload));
    expect(res.status).toBe(500);
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("creates the org, syncs metadata, and sends a confirmation email on success", async () => {
    (db.select as any).mockReturnValue(chain([]));
    const supabase = mockSupabase();
    (db.transaction as any).mockResolvedValue("org-123");

    const res = await POST(req(validPayload));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ orgId: "org-123", userId: "auth-1" });
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ app_metadata: expect.objectContaining({ organization_id: "org-123" }) })
    );
    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      "jane@acme.com",
      `${BRANDS.workplix.appUrl}/confirmed?token_hash=tok123&type=signup`,
      "Jane Admin",
      BRANDS.workplix
    );
  });

  it("returns 500 with the auth error when Supabase user creation fails", async () => {
    (db.select as any).mockReturnValue(chain([]));
    mockSupabase({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: null, error: { message: "email taken" } }),
          updateUserById: vi.fn(),
          deleteUser: vi.fn(),
          generateLink: vi.fn(),
        },
      },
    } as any);

    const res = await POST(req(validPayload));
    expect(res.status).toBe(500);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
