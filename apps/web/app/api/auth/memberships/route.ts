import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { employees, organizations } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";

// Lists the caller's active employee memberships across all organizations,
// for rendering an org picker when getApiUser/getUser reports more than one
// (see SelectOrganizationError in lib/auth/getUser.ts). Unlike getApiUser,
// this never requires an org selector — it's how the client discovers what
// to select from in the first place.
export async function GET() {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");

  let authUserId: string;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    authUserId = user.id;
  } else {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    authUserId = user.id;
  }

  const rows = await db
    .select({
      employeeId: employees.id,
      organizationId: employees.organizationId,
      organizationName: organizations.name,
      role: employees.role,
      branchId: employees.branchId,
    })
    .from(employees)
    .innerJoin(organizations, eq(organizations.id, employees.organizationId))
    .where(and(eq(employees.authUserId, authUserId), eq(employees.isActive, true)));

  return NextResponse.json({ memberships: rows });
}
