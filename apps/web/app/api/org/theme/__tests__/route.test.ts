import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "../route";
import { db } from "@/lib/db";
import { getApiUser } from "@/lib/auth/getUser";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/auth/getUser", () => ({ getApiUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const orgAdmin = { id: "u1", role: "org_admin" as const, organizationId: "org-1", branchId: null };
const manager = { id: "u2", role: "branch_manager" as const, organizationId: "org-1", branchId: "b1" };
const employee = { id: "u3", role: "employee" as const, organizationId: "org-1", branchId: "b1" };

const validTheme = {
  primary: "#111111",
  secondary: "#222222",
  accent: "#333333",
  background: "#ffffff",
  foreground: "#000000",
};

function req(body?: unknown, headers?: Record<string, string>) {
  return new Request("http://test", {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

describe("GET /api/org/theme", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when no theme is set", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.select as any).mockReturnValue(chain([]));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("PATCH /api/org/theme", () => {
  beforeEach(() => vi.resetAllMocks());

  it("forbids employees from updating the theme", async () => {
    (getApiUser as any).mockResolvedValue(employee);
    const res = await PATCH(req(validTheme));
    expect(res.status).toBe(403);
  });

  it("rejects invalid color values", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PATCH(req({ ...validTheme, primary: "not-a-hex" }));
    expect(res.status).toBe(400);
  });

  it("saves a valid theme as org admin", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    (db.update as any).mockReturnValue(chain([{ theme: validTheme }]));
    const res = await PATCH(req(validTheme));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(validTheme);
  });

  it("saves a valid theme as branch manager", async () => {
    (getApiUser as any).mockResolvedValue(manager);
    (db.update as any).mockReturnValue(chain([{ theme: validTheme }]));
    const res = await PATCH(req(validTheme));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(validTheme);
  });

  it("rejects theme writes on a locked-brand domain even for org admins", async () => {
    (getApiUser as any).mockResolvedValue(orgAdmin);
    const res = await PATCH(req(validTheme, { host: "seaudecrabe.workplix.app" }));
    expect(res.status).toBe(403);
  });
});
