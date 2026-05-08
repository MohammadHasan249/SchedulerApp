import { apiFetch } from "./client";
import type { OrganizationTheme } from "@scheduler/types";

export function getOrganizationTheme(): Promise<OrganizationTheme | null> {
  return apiFetch("/api/org/theme");
}

export function updateOrganizationTheme(
  theme: OrganizationTheme
): Promise<OrganizationTheme> {
  return apiFetch("/api/org/theme", {
    method: "PATCH",
    body: JSON.stringify(theme),
  });
}
