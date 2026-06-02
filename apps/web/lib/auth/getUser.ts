import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBrowserClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export type AppUser = {
  id: string;
  email: string;
  role: "org_admin" | "branch_manager" | "employee";
  organizationId: string;
  branchId: string | null;
};

export class ApiAuthError extends Error {
  constructor() { super("Unauthorized"); }
}

const VALID_ROLES = new Set(["org_admin", "branch_manager", "employee"]);

function parseAppUser(user: { id: string; email?: string; app_metadata: Record<string, unknown> }): AppUser {
  const role = user.app_metadata.role;
  const organizationId = user.app_metadata.organization_id;

  // Reject malformed sessions rather than letting `undefined` propagate through
  // every downstream filter. A misconfigured user (signup half-failed, manual
  // SQL edit) would otherwise silently match every row via
  // `eq(table.organizationId, undefined)`.
  if (typeof role !== "string" || !VALID_ROLES.has(role)) {
    throw new ApiAuthError();
  }
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new ApiAuthError();
  }

  return {
    id: user.id,
    email: user.email!,
    role: role as AppUser["role"],
    organizationId,
    branchId: (user.app_metadata.branch_id as string | undefined) ?? null,
  };
}

// For API route handlers — supports Bearer token (mobile) and cookie session (web).
// Throws ApiAuthError on failure; use withAuth to convert that to a 401 response.
// For Server Components and page layouts, use getUser() instead.
export async function getApiUser(): Promise<AppUser> {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new ApiAuthError();
    return parseAppUser(user);
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiAuthError();
  return parseAppUser(user);
}

export async function getUser(): Promise<AppUser> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return parseAppUser(user);
}
