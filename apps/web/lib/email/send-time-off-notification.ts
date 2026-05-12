import { Resend } from "resend";
import { db } from "@/lib/db";
import { employees, organizations } from "@scheduler/database/schema";
import { eq, and } from "drizzle-orm";

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendTimeOffNotification(
  employeeId: string,
  organizationId: string,
  startDate: string,
  endDate: string,
  reason: string | undefined
) {
  const resendClient = getResend();
  if (!resendClient) return;

  try {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!employee) {
      console.error("Employee not found:", employeeId);
      return;
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      console.error("Organization not found:", organizationId);
      return;
    }

    // Prefer the employee's branch manager; fall back to any org admin
    let recipientEmail: string | null = null;
    let recipientName = "Manager";

    if (employee.branchId) {
      const [manager] = await db
        .select({ name: employees.name, email: employees.email })
        .from(employees)
        .where(
          and(
            eq(employees.organizationId, organizationId),
            eq(employees.branchId, employee.branchId),
            eq(employees.role, "branch_manager"),
            eq(employees.isActive, true)
          )
        )
        .limit(1);

      if (manager) {
        recipientEmail = manager.email;
        recipientName = manager.name;
      }
    }

    if (!recipientEmail) {
      const [admin] = await db
        .select({ name: employees.name, email: employees.email })
        .from(employees)
        .where(
          and(
            eq(employees.organizationId, organizationId),
            eq(employees.role, "org_admin"),
            eq(employees.isActive, true)
          )
        )
        .limit(1);

      if (admin) {
        recipientEmail = admin.email;
        recipientName = admin.name;
      }
    }

    if (!recipientEmail) {
      console.warn("No manager or admin found to notify for org:", organizationId);
      return;
    }

    const start = new Date(startDate).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const end = new Date(endDate).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const safeEmployeeName = escapeHtml(employee.name);
    const safeOrgName = escapeHtml(org.name);
    const safeRecipientName = escapeHtml(recipientName);
    const safeReason = reason ? escapeHtml(reason) : null;

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
        <h2>New Time-Off Request</h2>
        <p style="margin: 0; color: #666;">From ${safeOrgName}</p>
      </div>

      <div class="content">
        <p>Hi ${safeRecipientName},</p>

        <p><strong>${safeEmployeeName}</strong> has submitted a time-off request that requires your approval.</p>

        <div class="details">
          <p><strong>Employee:</strong> ${safeEmployeeName}</p>
          <p><strong>Start Date:</strong> ${start}</p>
          <p><strong>End Date:</strong> ${end}</p>
          ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ""}
        </div>

        <p>Please log in to your dashboard to review and approve or deny this request.</p>

        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/time-off" class="button">View Request</a>
      </div>

      <div class="footer">
        <p>This is an automated message from Scheduler App. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `;

    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: recipientEmail,
      subject: `Time-Off Request from ${employee.name}`,
      html: emailHtml,
    });

    if (result.error) {
      console.error("Error sending email:", result.error);
    } else {
      console.log("Email sent successfully:", result.data?.id);
    }
  } catch (error) {
    console.error("Failed to send time-off notification:", error);
  }
}
