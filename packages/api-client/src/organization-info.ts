import { apiFetch } from "./client";

export function getOrganizationInfo(): Promise<{ name: string | null }> {
  return apiFetch("/api/org/info");
}
