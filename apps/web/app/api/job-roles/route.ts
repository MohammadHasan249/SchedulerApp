import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jobRoles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { requireManagerOrAdmin } from "@/lib/auth/policies";
import { eq } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1),
});

export const GET = withAuth(async function GET() {
  const user = await getUser();

  const rows = await db
    .select()
    .from(jobRoles)
    .where(eq(jobRoles.organizationId, user.organizationId));

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  const denied = requireManagerOrAdmin(user);
  if (denied) return denied;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [role] = await db
    .insert(jobRoles)
    .values({ organizationId: user.organizationId, name: parsed.data.name })
    .returning();

  return NextResponse.json(role, { status: 201 });
});
