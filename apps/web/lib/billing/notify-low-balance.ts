import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { createNotifications } from "@/lib/notifications";

/**
 * Notifies every active org_admin that the org's AI assistant balance is
 * running low. Best-effort — same as createNotifications, failures are
 * logged, not thrown, so a notification hiccup never blocks the AI request
 * that triggered it.
 */
export async function notifyLowBalance(organizationId: string): Promise<void> {
  const admins = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.isActive, true),
        eq(employees.role, "org_admin")
      )
    );

  await createNotifications(
    admins.map((a) => ({
      employeeId: a.id,
      organizationId,
      message:
        "Your AI scheduling assistant balance is running low. Visit Billing to upgrade your plan or buy more credits.",
    }))
  );
}
