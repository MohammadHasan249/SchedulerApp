import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizationHours, employees } from "@scheduler/database/schema";
import { getUser } from "@/lib/auth/getUser";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hours = await db
    .select()
    .from(organizationHours)
    .where(eq(organizationHours.organizationId, user.organizationId));

  if (hours.length === 0) {
    return NextResponse.json(
      { error: "No hours of operation configured yet" },
      { status: 400 }
    );
  }

  // Build availability schedule from organization hours
  const schedule: Record<number, { startTime: string; endTime: string }> = {};
  for (const h of hours) {
    if (!h.isClosed && h.startTime && h.endTime) {
      schedule[h.dayOfWeek] = {
        startTime: h.startTime,
        endTime: h.endTime,
      };
    }
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
      await tx.update(employees).set({ availabilitySchedule: schedule }).where(eq(employees.id, emp.id));
    }
  });

  return NextResponse.json({ applied: orgEmployees.length });
}
