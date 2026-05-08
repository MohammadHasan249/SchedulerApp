import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { eq } from "drizzle-orm";

export const GET = withAuth(async function GET() {
  const user = await getUser();
  const [org] = await db
    .select({ theme: organizations.theme })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);
  return NextResponse.json(org?.theme ?? null);
});

const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const PATCH = withAuth(async function PATCH(request: Request) {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = themeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [org] = await db
    .update(organizations)
    .set({ theme: parsed.data })
    .where(eq(organizations.id, user.organizationId))
    .returning({ theme: organizations.theme });

  return NextResponse.json(org.theme);
});
