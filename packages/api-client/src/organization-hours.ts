import { apiFetch } from "./client";

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
