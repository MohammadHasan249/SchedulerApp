import { apiFetch } from "./client";
import type { Shift, ShiftAssignment } from "@scheduler/types";

export function getShifts(weekStart: string): Promise<Shift[]> {
  return apiFetch(`/api/shifts?weekStart=${encodeURIComponent(weekStart)}`);
}

export function createShift(data: {
  branchId: string;
  startTime: string;
  endTime: string;
}): Promise<Shift> {
  return apiFetch("/api/shifts", { method: "POST", body: JSON.stringify(data) });
}

export function updateShift(
  id: string,
  data: { startTime?: string; endTime?: string }
): Promise<Shift> {
  return apiFetch(`/api/shifts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteShift(id: string): Promise<void> {
  return apiFetch(`/api/shifts/${id}`, { method: "DELETE" });
}

export function assignEmployee(
  shiftId: string,
  employeeId: string
): Promise<ShiftAssignment> {
  return apiFetch(`/api/shifts/${shiftId}/assign`, {
    method: "POST",
    body: JSON.stringify({ employeeId }),
  });
}

export function unassignEmployee(
  shiftId: string,
  assignmentId: string
): Promise<void> {
  return apiFetch(`/api/shifts/${shiftId}/assign`, {
    method: "DELETE",
    body: JSON.stringify({ assignmentId }),
  });
}

export function publishShifts(branchId: string, weekStart: string): Promise<void> {
  return apiFetch("/api/shifts/publish", {
    method: "POST",
    body: JSON.stringify({ branchId, weekStart }),
  });
}
