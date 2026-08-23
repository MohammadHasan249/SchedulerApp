import { useAuthStore } from "./authStore";

export type AppRole = "org_admin" | "branch_manager" | "employee";

export function useRole(): AppRole {
  const { session } = useAuthStore();
  return (session?.user?.app_metadata?.role as AppRole) ?? "employee";
}

export function useIsAdmin(): boolean {
  const role = useRole();
  return role === "org_admin" || role === "branch_manager";
}

export function useBranchId(): string | null {
  const { session } = useAuthStore();
  return (session?.user?.app_metadata?.branch_id as string | undefined) ?? null;
}
