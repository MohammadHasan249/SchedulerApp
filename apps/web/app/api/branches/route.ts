import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@scheduler/database/schema";
import { getUserForApi as getUser } from "@/lib/auth/getUser"
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().optional(),
  timezone: z.string().default("UTC"),
});

export const GET = withAuth(async function GET() {
  const user = await getUser();

  const rows = await db
    .select()
    .from(branches)
    .where(eq(branches.organizationId, user.organizationId));

  return NextResponse.json(rows);
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, address, timezone } = parsed.data;
  const slug = parsed.data.slug ?? slugify(name);

  // Check slug uniqueness within org
  const [existing] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.organizationId, user.organizationId), eq(branches.slug, slug)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "A branch with this slug already exists" }, { status: 409 });
  }

  const [branch] = await db
    .insert(branches)
    .values({ organizationId: user.organizationId, name, slug, address, timezone })
    .returning();

  return NextResponse.json(branch, { status: 201 });
});
