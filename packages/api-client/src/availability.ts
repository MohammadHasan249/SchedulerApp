import { apiFetch } from "./client";

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

export type AvailabilitySchedule = Record<string, AvailabilitySlot>;

export function getAvailability(employeeId: string): Promise<AvailabilitySchedule> {
  return apiFetch(`/api/availability/${employeeId}`);
}

export function saveAvailability(
  employeeId: string,
  schedule: AvailabilitySchedule
): Promise<AvailabilitySchedule> {
  return apiFetch(`/api/availability/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(schedule),
  });
}
