import { apiFetch } from "./client";
import type { Shift, ShiftAssignment, AutoAssignResult } from "@scheduler/types";

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

export function getShiftAssignments(shiftId: string): Promise<ShiftAssignment[]> {
  return apiFetch(`/api/shifts/${shiftId}/assign`);
}

// GET /api/employees only ever returns an "employee"-role caller's own
// record (the roster is manager/admin-only), so employees building a shift
// swap request can't use it to find a coworker to cover their shift. This
// hits the dedicated endpoint that returns just the minimal id/name list of
// employees eligible to cover a given shift.
export function getEligibleCovers(shiftId: string): Promise<{ id: string; name: string }[]> {
  return apiFetch(`/api/shifts/${shiftId}/eligible-covers`);
}

export function autoAssignShifts(
  branchId: string,
  fromDate: string,
  toDate: string
): Promise<{ success: boolean; assignmentsCreated: number; assignments: AutoAssignResult[] }> {
  return apiFetch("/api/shifts/auto-assign", {
    method: "POST",
    body: JSON.stringify({ branchId, fromDate, toDate }),
  });
}
