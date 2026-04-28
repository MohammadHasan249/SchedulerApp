import { Resend } from "resend";
import { db } from "@/lib/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

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
) {
  const resendClient = getResend();
  if (!resendClient) {
    console.warn("Skipping email notification - RESEND_API_KEY not configured");
    return;
  }

  try {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      console.error("Organization not found:", organizationId);
      return;
    }

    // Check if user exists in Supabase auth
    const supabase = await createClient();
    let userExists = false;
    try {
      const { data: userData } = await supabase.auth.admin.getUserByEmail(employeeEmail);
      userExists = !!userData?.user;
    } catch (error) {
      userExists = false;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let emailHtml: string;
    let subject: string;

    if (userExists) {
      // User already has an account
      subject = `You've been invited to join ${org.name}`;
      emailHtml = `
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
        <h2>Welcome to ${org.name}!</h2>
        <p style="margin: 0; color: #666;">You've been invited to join our team</p>
      </div>

      <div class="content">
        <p>Hi ${employeeName},</p>

        <p>You've been invited to join <strong>${org.name}</strong> on Scheduler App. Your account is ready to use!</p>

        <div class="details">
          <p><strong>Organization:</strong> ${org.name}</p>
          <p><strong>Next Steps:</strong> Log in to your account to get started with scheduling and team management.</p>
        </div>

        <p>Click the button below to access your dashboard:</p>

        <a href="${appUrl}/dashboard" class="button">Go to Dashboard</a>
      </div>

      <div class="footer">
        <p>This is an automated message from Scheduler App. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
      `;
    } else {
      // User doesn't have an account - send signup invitation
      subject = `Join ${org.name} on Scheduler App`;
      emailHtml = `
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
        <h2>Join ${org.name}!</h2>
        <p style="margin: 0; color: #666;">You've been invited to use Scheduler App</p>
      </div>

      <div class="content">
        <p>Hi ${employeeName},</p>

        <p>You've been invited to join <strong>${org.name}</strong> on Scheduler App, a modern workforce scheduling platform.</p>

        <div class="details">
          <p><strong>Organization:</strong> ${org.name}</p>
          <p><strong>Next Steps:</strong> Create your account to start managing schedules and time off.</p>
        </div>

        <p>Click the button below to create your account and get started:</p>

        <a href="${appUrl}/signup/employee" class="button">Create Account</a>
      </div>

      <div class="footer">
        <p>This is an automated message from Scheduler App. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
      `;
    }

    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: employeeEmail,
      subject,
      html: emailHtml,
    });

    if (result.error) {
      console.error("Error sending email:", result.error);
    } else {
      console.log("Invitation email sent successfully:", result.data?.id);
    }
  } catch (error) {
    console.error("Failed to send employee invitation:", error);
  }
}
