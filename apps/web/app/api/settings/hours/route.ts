import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq } from "drizzle-orm";

const timeRegex = /^\d{2}:\d{2}$/;
const scheduleSchema = z.record(
  z.string().regex(/^[0-6]$/),
  z.object({
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
  })
);

export const GET = withAuth(async function GET() {
  const user = await getUser();
  const [org] = await db
    .select({ hoursSchedule: organizations.hoursSchedule })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);
  return NextResponse.json(org?.hoursSchedule ?? {});
});

export const PUT = withAuth(async function PUT(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invalid = Object.values(parsed.data).find((s) => s.startTime >= s.endTime);
  if (invalid) {
    return NextResponse.json(
      { error: "Start time must be before end time for all open days" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(organizations)
    .set({ hoursSchedule: parsed.data })
    .where(eq(organizations.id, user.organizationId))
    .returning({ hoursSchedule: organizations.hoursSchedule });

  return NextResponse.json(updated.hoursSchedule);
});
