import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { headers, cookies } from "next/headers";
import { db } from "@/lib/db";
import { employees } from "@scheduler/database/schema";
import { and, eq } from "drizzle-orm";

export type AppUser = {
  id: string;
  email: string;
  employeeId: string;
  role: "org_admin" | "branch_manager" | "employee";
  organizationId: string;
  branchId: string | null;
};

export type Membership = {
  employeeId: string;
  organizationId: string;
  role: "org_admin" | "branch_manager" | "employee";
  branchId: string | null;
};

export class ApiAuthError extends Error {
  constructor() { super("Unauthorized"); }
}

/**
 * Thrown when an auth user has more than one active employee membership and
 * no (or an invalid) organization selector was supplied — the caller needs
 * to pick which org they're operating in before we can build an AppUser.
 */
export class SelectOrganizationError extends Error {
  constructor(public memberships: Membership[]) {
    super("Select an organization");
  }
}

export const ACTIVE_ORG_COOKIE = "active_org_id";

// One Supabase auth user can hold an active `employees` row in more than one
// organization (e.g. rejoined after being deactivated elsewhere, or works two
// jobs) — so authorization is resolved fresh from the DB every request rather
// than trusted off the JWT's app_metadata, which can only ever hold one
// role/org/branch and would silently pick the wrong one.
async function resolveMembership(authUserId: string, orgSelector: string | null): Promise<AppUser> {
  const rows = await db
    .select({
      employeeId: employees.id,
      organizationId: employees.organizationId,
      role: employees.role,
      branchId: employees.branchId,
    })
    .from(employees)
    .where(and(eq(employees.authUserId, authUserId), eq(employees.isActive, true)));

  if (rows.length === 0) {
    throw new ApiAuthError();
  }

  const match = rows.length === 1 ? rows[0] : rows.find((r) => r.organizationId === orgSelector);

  if (!match) {
    throw new SelectOrganizationError(rows);
  }

  return {
    id: authUserId,
    email: "",
    employeeId: match.employeeId,
    role: match.role,
    organizationId: match.organizationId,
    branchId: match.branchId,
  };
}

// For API route handlers — supports Bearer token (mobile) and cookie session (web).
// Throws ApiAuthError on failure; use withAuth to convert that to a 401 response.
// For Server Components and page layouts, use getUser() instead.
export async function getApiUser(): Promise<AppUser> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  const orgSelector = headerStore.get("x-organization-id");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new ApiAuthError();
    const appUser = await resolveMembership(user.id, orgSelector);
    return { ...appUser, email: user.email! };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiAuthError();

  const cookieStore = await cookies();
  const cookieOrgSelector = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const appUser = await resolveMembership(user.id, orgSelector ?? cookieOrgSelector);
  return { ...appUser, email: user.email! };
}

export async function getUser(): Promise<AppUser> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const cookieStore = await cookies();
  const orgSelector = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;

  try {
    const appUser = await resolveMembership(user.id, orgSelector);
    return { ...appUser, email: user.email! };
  } catch (e) {
    if (e instanceof SelectOrganizationError) {
      redirect("/select-organization");
    }
    redirect("/login");
  }
}
