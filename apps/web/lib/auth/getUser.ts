import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  role: "org_admin" | "branch_manager" | "employee";
  organizationId: string;
  branchId: string | null;
};

export async function getUser(): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email!,
    role: user.app_metadata.role,
    organizationId: user.app_metadata.organization_id,
    branchId: user.app_metadata.branch_id ?? null,
  };
}
