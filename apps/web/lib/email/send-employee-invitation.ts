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

export async function sendEmployeeInvitationEmail(
  employeeName: string,
  employeeEmail: string,
  organizationId: string,
  pin: string
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

    const brand = getBrandForOrgSlug(org.slug);
    const appUrl = brand.appUrl;
    const safeOrgName = escapeHtml(org.name);
    const safeEmployeeName = escapeHtml(employeeName);

    // A locked-org brand (e.g. Seau de Crabe) is a white-label deployment for
    // that one specific business — its displayName is the org's own name, not
    // a separate scheduling product. "Join Seau de Crabe on Seau de Crabe, a
    // modern workforce scheduling platform" would be redundant and misleading
    // (it isn't a platform the org built), so drop the second mention.
    const isWhiteLabel = brand.lockedOrgSlug !== null;

    // Every invite creates a fresh employee row with authUserId: null, so the
    // invitee always needs to create an account — there's no "already has an
    // account, just log in" case for a brand-new invite.
    const subject = isWhiteLabel ? `Join ${org.name}` : `Join ${org.name} on ${brand.displayName}`;
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
      .pin { display: inline-block; margin-top: 8px; padding: 10px 20px; background-color: #fff; border: 2px dashed #3b82f6; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e40af; }
      .button { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; border-radius: 6px; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Join ${safeOrgName}!</h2>
        <p style="margin: 0; color: #666;">${
          isWhiteLabel
            ? "You've been invited to join the team"
            : `You've been invited to use ${brand.displayName}`
        }</p>
      </div>
      <div class="content">
        <p>Hi ${safeEmployeeName},</p>
        <p>${
          isWhiteLabel
            ? `You've been invited to join <strong>${safeOrgName}</strong>.`
            : `You've been invited to join <strong>${safeOrgName}</strong> on ${brand.displayName}, a modern workforce scheduling platform.`
        }</p>
        <div class="details">
          <p><strong>Organization:</strong> ${safeOrgName}</p>
          <p><strong>Your kiosk PIN:</strong></p>
          <div class="pin">${pin}</div>
          <p style="margin-top: 12px;">Use this PIN to clock in and out at your workplace kiosk.</p>
          <p><strong>Next Steps:</strong> Create your account below to view your schedule, manage availability, and request time off.</p>
        </div>
        <a href="${appUrl}/signup/employee" class="button" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px;">Create Account</a>
      </div>
      <div class="footer">
        <p>This is an automated message from ${isWhiteLabel ? safeOrgName : brand.displayName}. Please do not reply to this email.</p>
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
