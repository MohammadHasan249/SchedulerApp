import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { permissionProfiles } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { PERMISSION_KEYS } from "@scheduler/types";
import { eq, and } from "drizzle-orm";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    permissions: z.array(z.enum(PERMISSION_KEYS)).optional(),
  })
  .refine((d) => d.name !== undefined || d.permissions !== undefined, {
    message: "Nothing to update",
  });

export const PATCH = withAuth(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (user.role !== "org_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: { name?: string; permissions?: string[] } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.permissions !== undefined) {
    updates.permissions = [...new Set(parsed.data.permissions)];
  }

  try {
    const [updated] = await db
      .update(permissionProfiles)
      .set(updates)
      .where(
        and(
          eq(permissionProfiles.id, id),
          eq(permissionProfiles.organizationId, user.organizationId)
        )
      )
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "A profile with that name already exists." },
      { status: 409 }
    );
  }
});

export const DELETE = withAuth(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (user.role !== "org_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // employees.permission_profile_id is ON DELETE SET NULL, so affected employees
  // simply fall back to their base-role access.
  const [deleted] = await db
    .delete(permissionProfiles)
    .where(
      and(eq(permissionProfiles.id, id), eq(permissionProfiles.organizationId, user.organizationId))
    )
    .returning({ id: permissionProfiles.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
});
