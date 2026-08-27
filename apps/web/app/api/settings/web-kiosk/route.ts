import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/utils/safe-json";
import { db } from "@/lib/db";
import { organizations } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq } from "drizzle-orm";

const bodySchema = z.object({ enabled: z.boolean() });

export const PUT = withAuth(async function PUT(request: Request) {
  const user = await getUser();
  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [body, jsonErr] = await safeJson(request);
  if (jsonErr) return jsonErr;
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .update(organizations)
    .set({ webKioskEnabled: parsed.data.enabled })
    .where(eq(organizations.id, user.organizationId));

  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
});
