import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizationHours, employees, availability } from "@scheduler/database/schema";
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

  const slots = hours
    .filter((h) => !h.isClosed && h.startTime && h.endTime)
    .map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime!,
      endTime: h.endTime!,
    }));

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
      await tx.delete(availability).where(eq(availability.employeeId, emp.id));
      if (slots.length > 0) {
        await tx.insert(availability).values(
          slots.map((s) => ({ employeeId: emp.id, ...s }))
        );
      }
    }
  });

  return NextResponse.json({ applied: orgEmployees.length });
}
