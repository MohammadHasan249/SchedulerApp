import { logger } from "@/lib/logger";
import { Resend } from "resend";
import { BRANDS, type BrandConfig } from "@/lib/brand";

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
  fullName?: string,
  brand: BrandConfig = BRANDS.workplix
): Promise<{ sent: boolean }> {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn("Skipping confirmation email - RESEND_API_KEY not configured");
    return { sent: false };
  }

  const safeName = fullName ? escapeHtml(fullName) : null;
  const subject = `Confirm your email for ${brand.displayName}`;
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
                <h1 style="margin:0; font-size:20px; line-height:1.3; color:#101828; font-weight:600;">Confirm your email address</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px; color:#475467; font-size:15px; line-height:1.6;">
                <p style="margin:12px 0;">${safeName ? `Hi ${safeName},` : "Hi,"}</p>
                <p style="margin:12px 0;">Thanks for signing up for ${brand.displayName}. Please confirm your email address to finish setting up your account.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 8px 40px;">
                <a href="${confirmUrl}" style="display:inline-block; width:100%; box-sizing:border-box; text-align:center; padding:12px 24px; background-color:#4f46e5; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">Confirm email</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 32px 40px; color:#98a2b3; font-size:13px; line-height:1.6;">
                <p style="margin:0;">If the button above doesn't work, copy and paste this link into your browser:</p>
                <p style="margin:8px 0 0 0; word-break:break-all;"><a href="${confirmUrl}" style="color:#4f46e5; text-decoration:underline;">${confirmUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px; background-color:#f9fafb; border-top:1px solid #eaecf0;">
                <p style="margin:0; font-size:12px; color:#98a2b3; line-height:1.5;">If you didn't request this email, you can safely ignore it. This is an automated message from ${brand.displayName} — please don't reply.</p>
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
