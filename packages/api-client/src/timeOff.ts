import { apiFetch } from "./client";
import type { TimeOffRequest } from "@scheduler/types";

export function getTimeOffRequests(): Promise<TimeOffRequest[]> {
  return apiFetch("/api/time-off");
}

export function createTimeOffRequest(data: {
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<TimeOffRequest> {
  return apiFetch("/api/time-off", { method: "POST", body: JSON.stringify(data) });
}

export function updateTimeOffRequest(
  id: string,
  data: { status: "approved" | "denied" }
): Promise<TimeOffRequest> {
  return apiFetch(`/api/time-off/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cancelTimeOffRequest(id: string): Promise<void> {
  return apiFetch(`/api/time-off/${id}`, { method: "DELETE" });
}
