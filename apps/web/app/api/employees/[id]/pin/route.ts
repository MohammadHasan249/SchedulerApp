import { NextResponse } from "next/server";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { getUser } from "@/lib/auth/getUser";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { eq, and } from "drizzle-orm";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const { id } = await params;

  // Users can only update their own PIN
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.authUserId, user.id)))
    .limit(1);

  if (!employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = pinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pinHash = await bcryptjs.hash(parsed.data.pin, 10);

  const [updated] = await db
    .update(employees)
    .set({ pinHash })
    .where(eq(employees.id, id))
    .returning();

  return NextResponse.json({ success: true, name: updated.name });
}
