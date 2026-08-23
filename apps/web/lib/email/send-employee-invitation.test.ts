import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmployeeInvitationEmail } from "./send-employee-invitation";
import { db } from "@/lib/db";
import { chain } from "@/test/db-mock";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

describe("sendEmployeeInvitationEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  it("no-ops without calling Supabase admin APIs when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmployeeInvitationEmail("Jane", "jane@x.com", "org-1");
    expect(result).toEqual({ sent: false });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns sent:false when the organization can't be found", async () => {
    (db.select as any).mockReturnValue(chain([]));
    const result = await sendEmployeeInvitationEmail("Jane", "jane@x.com", "org-1");
    expect(result).toEqual({ sent: false });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends the invitation with the org's name resolved from the database", async () => {
    (db.select as any).mockReturnValue(chain([{ id: "org-1", name: "Acme Co" }]));
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await sendEmployeeInvitationEmail("Jane", "jane@x.com", "org-1");

    expect(result).toEqual({ sent: true });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@x.com", subject: expect.stringContaining("Acme Co") })
    );
  });

  it("regression (BUGS.md #7): escapes HTML in employee and org names to prevent injection", async () => {
    (db.select as any).mockReturnValue(
      chain([{ id: "org-1", name: '<img src=x onerror=alert(1)>Acme' }])
    );
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await sendEmployeeInvitationEmail('<script>alert("xss")</script>', "jane@x.com", "org-1");

    const call = sendMock.mock.calls[0][0];
    expect(call.html).not.toContain("<script>");
    expect(call.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(call.html).toContain("&lt;script&gt;");
  });

  it("returns sent:false when Resend reports an error", async () => {
    (db.select as any).mockReturnValue(chain([{ id: "org-1", name: "Acme Co" }]));
    sendMock.mockResolvedValue({ data: null, error: { message: "bounced" } });

    const result = await sendEmployeeInvitationEmail("Jane", "jane@x.com", "org-1");
    expect(result).toEqual({ sent: false });
  });

  it("catches an unexpected throw and returns sent:false instead of propagating", async () => {
    (db.select as any).mockReturnValue(chain([{ id: "org-1", name: "Acme Co" }]));
    sendMock.mockRejectedValue(new Error("network error"));

    const result = await sendEmployeeInvitationEmail("Jane", "jane@x.com", "org-1");
    expect(result).toEqual({ sent: false });
  });
});
