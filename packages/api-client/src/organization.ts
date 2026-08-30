import { apiFetch } from "./client";
import type { OrganizationTheme } from "@scheduler/types";

export function getOrganizationInfo(): Promise<{ name: string | null; slug: string | null }> {
  return apiFetch("/api/org/info");
}

// Keys are day-of-week strings "0"–"6". A missing key means the day is closed.
export type HoursSchedule = Record<string, { startTime: string; endTime: string }>;

export function getOrganizationHours(): Promise<HoursSchedule> {
  return apiFetch("/api/settings/hours");
}

export function updateOrganizationHours(schedule: HoursSchedule): Promise<HoursSchedule> {
  return apiFetch("/api/settings/hours", {
    method: "PUT",
    body: JSON.stringify(schedule),
  });
}

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
