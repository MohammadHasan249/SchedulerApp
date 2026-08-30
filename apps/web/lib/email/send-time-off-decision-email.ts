import { logger } from "@/lib/logger";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
import { getBrandForOrgSlug } from "@/lib/brand";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured - emails will not be sent");
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendTimeOffDecisionEmail(
  employeeEmail: string,
  employeeName: string,
  status: "approved" | "denied",
  startDate: string,
  endDate: string,
  organizationId: string
): Promise<{ sent: boolean }> {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn("Skipping time-off decision email - RESEND_API_KEY not configured");
    return { sent: false };
  }

  const [org] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const brand = getBrandForOrgSlug(org?.slug);

  const safeName = escapeHtml(employeeName);
  const isApproved = status === "approved";
  const accentColor = isApproved ? "#16a34a" : "#dc2626";
  const subject = isApproved ? "Your time-off request was approved" : "Your time-off request was denied";
  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(16,24,40,0.08);">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <div style="font-size:20px; font-weight:700; color:#4f46e5; letter-spacing:-0.01em;">${brand.displayName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;">
                <h1 style="margin:0; font-size:20px; line-height:1.3; color:#101828; font-weight:600;">${subject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px; color:#475467; font-size:15px; line-height:1.6;">
                <p style="margin:12px 0;">Hi ${safeName},</p>
                <p style="margin:12px 0;">Your time-off request has been <strong style="color:${accentColor};">${status}</strong>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 24px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; border-left:4px solid ${accentColor}; border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px; font-size:14px; color:#101828;">
                      <strong>Dates:</strong> ${startDate} – ${endDate}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px; background-color:#f9fafb; border-top:1px solid #eaecf0;">
                <p style="margin:0; font-size:12px; color:#98a2b3; line-height:1.5;">This is an automated message from ${brand.displayName} — please don't reply. Contact your manager if you have questions.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
      `;

  try {
    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: employeeEmail,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      logger.error("Error sending time-off decision email:", result.error);
      return { sent: false };
    }
    console.log("Time-off decision email sent successfully:", result.data?.id);
    return { sent: true };
  } catch (error) {
    logger.error("Failed to send time-off decision email:", error);
    return { sent: false };
  }
}
