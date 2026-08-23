import { logger } from "@/lib/logger";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";
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

export async function sendEmployeeInvitationEmail(
  employeeName: string,
  employeeEmail: string,
  organizationId: string
): Promise<{ sent: boolean }> {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn("Skipping email notification - RESEND_API_KEY not configured");
    return { sent: false };
  }

  try {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      logger.error("Organization not found:", organizationId);
      return { sent: false };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const safeOrgName = escapeHtml(org.name);
    const safeEmployeeName = escapeHtml(employeeName);

    // Every invite creates a fresh employee row with authUserId: null, so the
    // invitee always needs to create an account — there's no "already has an
    // account, just log in" case for a brand-new invite.
    const subject = `Join ${org.name} on Workplix`;
    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .content { line-height: 1.6; }
      .details { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
      .button { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Join ${safeOrgName}!</h2>
        <p style="margin: 0; color: #666;">You've been invited to use Workplix</p>
      </div>
      <div class="content">
        <p>Hi ${safeEmployeeName},</p>
        <p>You've been invited to join <strong>${safeOrgName}</strong> on Workplix, a modern workforce scheduling platform.</p>
        <div class="details">
          <p><strong>Organization:</strong> ${safeOrgName}</p>
          <p><strong>Next Steps:</strong> Create your account to start managing schedules and time off.</p>
        </div>
        <a href="${appUrl}/signup/employee" class="button">Create Account</a>
      </div>
      <div class="footer">
        <p>This is an automated message from Workplix. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
      `;

    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: employeeEmail,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      logger.error("Error sending email:", result.error);
      return { sent: false };
    }
    console.log("Invitation email sent successfully:", result.data?.id);
    return { sent: true };
  } catch (error) {
    logger.error("Failed to send employee invitation:", error);
    return { sent: false };
  }
}
