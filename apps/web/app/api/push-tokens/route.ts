import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushTokens, employees } from "@scheduler/database/schema";
import { getApiUser as getUser } from "@/lib/auth/getUser";
import { withAuth } from "@/lib/auth/withAuth";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const POST = withAuth(async function POST(request: Request) {
  const user = await getUser();
  const { token } = await request.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const [emp] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.authUserId, user.id), eq(employees.organizationId, user.organizationId)))
    .limit(1);

  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .insert(pushTokens)
    .values({ employeeId: emp.id, token })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { employeeId: emp.id, createdAt: sql`now()` },
    })
    .returning();

  return NextResponse.json(row);
});

export const DELETE = withAuth(async function DELETE(request: Request) {
  const { token } = await request.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  await db.delete(pushTokens).where(eq(pushTokens.token, token));

  return NextResponse.json({ ok: true });
});
