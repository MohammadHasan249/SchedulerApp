import { apiFetch } from "./client";
import type { Availability } from "@scheduler/types";

export function getAvailability(employeeId: string): Promise<Availability[]> {
  return apiFetch(`/api/availability/${employeeId}`);
}

export function saveAvailability(
  employeeId: string,
  slots: { dayOfWeek: number; startTime: string; endTime: string }[]
): Promise<Availability[]> {
  return apiFetch(`/api/availability/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(slots),
  });
}
