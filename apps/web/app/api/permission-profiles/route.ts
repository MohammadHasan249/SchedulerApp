import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { permissionProfiles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { PERMISSION_KEYS } from "@scheduler/types";
import { eq, asc } from "drizzle-orm";

export const GET = withAuth(async function GET() {
  const user = await getUser();
  if (user.role !== "org_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select()
    .from(permissionProfiles)
    .where(eq(permissionProfiles.organizationId, user.organizationId))
    .orderBy(asc(permissionProfiles.name));

  return NextResponse.json(rows);
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  permissions: z.array(z.enum(PERMISSION_KEYS)).default([]),
});

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Dedupe permission keys before storing.
  const permissions = [...new Set(parsed.data.permissions)];

  try {
    const [created] = await db
      .insert(permissionProfiles)
      .values({
        organizationId: user.organizationId,
        name: parsed.data.name,
        permissions,
      })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch {
    // Unique (organization_id, name) violation.
    return NextResponse.json(
      { error: "A profile with that name already exists." },
      { status: 409 }
    );
  }
});
