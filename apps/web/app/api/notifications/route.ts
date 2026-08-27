import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and, desc } from "drizzle-orm";

export const GET = withAuth(async function GET(request: Request) {
  const user = await getUser();
  const url = new URL(request.url);

  if (url.searchParams.get("unreadCount") === "true") {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
      .limit(1);

    if (!emp) return NextResponse.json({ count: 0 });

    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.employeeId, emp.id),
          eq(notifications.organizationId, user.organizationId),
          eq(notifications.isRead, false)
        )
      );

    return NextResponse.json({ count: rows.length });
  }

  const limit = Number(url.searchParams.get("limit")) || 50;
  const offset = Number(url.searchParams.get("offset")) || 0;

  // Find the employee row for this auth user
  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.employeeId, emp.id), eq(notifications.organizationId, user.organizationId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
});
