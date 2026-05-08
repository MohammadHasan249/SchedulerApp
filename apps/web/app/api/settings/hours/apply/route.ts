import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";

export const POST = withAuth(async function POST() {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [org] = await db
    .select({ hoursSchedule: organizations.hoursSchedule })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  if (!org?.hoursSchedule || Object.keys(org.hoursSchedule).length === 0) {
    return NextResponse.json(
      { error: "No hours of operation configured yet" },
      { status: 400 }
    );
  }

  const orgEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, user.organizationId),
        eq(employees.isActive, true)
      )
    );

  await db.transaction(async (tx) => {
    for (const emp of orgEmployees) {
      await tx
        .update(employees)
        .set({ availabilitySchedule: org.hoursSchedule })
        .where(eq(employees.id, emp.id));
    }
  });

  return NextResponse.json({ applied: orgEmployees.length });
});
