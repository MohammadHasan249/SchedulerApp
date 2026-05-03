import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  foreground: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export async function PATCH(request: Request) {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = themeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [org] = await db
      .update(organizations)
      .set({ theme: parsed.data })
      .where(eq(organizations.id, user.organizationId))
      .returning();

    return NextResponse.json(org);
  } catch {
    return NextResponse.json(
      { error: "Theme update failed. DB migration may be pending." },
      { status: 503 }
    );
  }
}
