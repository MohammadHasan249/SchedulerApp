import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizationHours } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq } from "drizzle-orm";

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  isClosed: z.boolean(),
});

const putSchema = z.array(slotSchema).length(7);

export const GET = withAuth(async function GET() {
  const user = await getUser();

  const rows = await db
    .select()
    .from(organizationHours)
    .where(eq(organizationHours.organizationId, user.organizationId));

  return NextResponse.json(rows);
});

export const PUT = withAuth(async function PUT(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invalid = parsed.data.find(
    (s) => !s.isClosed && (s.startTime === null || s.endTime === null || s.startTime >= s.endTime)
  );
  if (invalid) {
    return NextResponse.json(
      { error: "Open days must have a valid start time before end time" },
      { status: 400 }
    );
  }

  await db.delete(organizationHours).where(
    eq(organizationHours.organizationId, user.organizationId)
  );

  const inserted = await db
    .insert(organizationHours)
    .values(
      parsed.data.map((slot) => ({
        organizationId: user.organizationId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.isClosed ? null : slot.startTime,
        endTime: slot.isClosed ? null : slot.endTime,
        isClosed: slot.isClosed,
      }))
    )
    .returning();

  return NextResponse.json(inserted);
});
