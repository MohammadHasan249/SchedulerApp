import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, employees } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  // Find the employee row for this auth user
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the notification belongs to this employee
  const [row] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.employeeId, emp.id),
        eq(notifications.organizationId, user.organizationId)
      )
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id))
    .returning();

  return NextResponse.json(updated);
}
