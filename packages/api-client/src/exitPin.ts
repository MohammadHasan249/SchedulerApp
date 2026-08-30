import { apiFetch } from "./client";

export function getExitPinStatus(): Promise<{ configured: boolean }> {
  return apiFetch("/api/settings/exit-pin", { method: "GET" });
}

export function setExitPin(pin: string): Promise<{ ok: boolean }> {
  return apiFetch("/api/settings/exit-pin", {
    method: "PUT",
    body: JSON.stringify({ pin }),
  });
}

export function verifyExitPin(
  pin: string
): Promise<{ valid: boolean; configured: boolean }> {
  return apiFetch("/api/settings/exit-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}
