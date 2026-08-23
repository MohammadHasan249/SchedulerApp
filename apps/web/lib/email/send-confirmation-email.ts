import { logger } from "@/lib/logger";
import { Resend } from "resend";

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

export async function sendConfirmationEmail(
  email: string,
  confirmUrl: string,
  fullName?: string
): Promise<{ sent: boolean }> {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn("Skipping confirmation email - RESEND_API_KEY not configured");
    return { sent: false };
  }

  const safeGreeting = fullName ? `Hi ${escapeHtml(fullName)},` : "Hi,";
  const subject = "Confirm your email for Workplix";
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
      .button { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; }
      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Confirm your email</h2>
      </div>
      <div class="content">
        <p>${safeGreeting}</p>
        <p>Please confirm your email address to finish setting up your Workplix account.</p>
        <a href="${confirmUrl}" class="button">Confirm Email</a>
      </div>
      <div class="footer">
        <p>This is an automated message from Workplix. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
      `;

  try {
    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      logger.error("Error sending confirmation email:", result.error);
      return { sent: false };
    }
    console.log("Confirmation email sent successfully:", result.data?.id);
    return { sent: true };
  } catch (error) {
    logger.error("Failed to send confirmation email:", error);
    return { sent: false };
  }
}
