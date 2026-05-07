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

function parseAppUser(user: { id: string; email?: string; app_metadata: Record<string, unknown> }): AppUser {
  return {
    id: user.id,
    email: user.email!,
    role: user.app_metadata.role as AppUser["role"],
    organizationId: user.app_metadata.organization_id as string,
    branchId: (user.app_metadata.branch_id as string | undefined) ?? null,
  };
}

// Used by API routes — supports both cookie sessions and Bearer token auth (mobile)
export async function getUserForApi(): Promise<AppUser> {
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
