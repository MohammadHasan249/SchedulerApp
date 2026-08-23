import { NextResponse } from "next/server";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";

export const GET = withAuth(async function GET() {
  const user = await getUser();
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);
  return NextResponse.json({ name: org?.name ?? null });
});
