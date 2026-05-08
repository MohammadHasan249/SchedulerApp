import { apiFetch } from "./client";
import type { OrganizationTheme } from "@scheduler/types";

export function getOrganizationTheme(): Promise<OrganizationTheme | null> {
  return apiFetch("/api/org/theme");
}
