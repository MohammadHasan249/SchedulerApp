import { apiFetch } from "./client";
import type { ShiftSwapRequest } from "@scheduler/types";

export function getShiftSwaps(): Promise<ShiftSwapRequest[]> {
  return apiFetch("/api/shift-swaps");
}

export function createShiftSwap(data: {
  shiftId: string;
  coverId?: string;
}): Promise<ShiftSwapRequest> {
  return apiFetch("/api/shift-swaps", { method: "POST", body: JSON.stringify(data) });
}

export function updateShiftSwap(
  id: string,
  action: "accept_cover" | "manager_approve" | "deny"
): Promise<ShiftSwapRequest> {
  return apiFetch(`/api/shift-swaps/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}
