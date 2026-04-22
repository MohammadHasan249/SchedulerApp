import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, employees } from "@/db/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const user = await getUser();

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
    .limit(50);

  return NextResponse.json(rows);
}
