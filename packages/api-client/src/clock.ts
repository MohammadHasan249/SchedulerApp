import { apiFetch } from "./client";

export type ClockPunchResult = {
  employeeName: string;
  clockType: "clock_in" | "clock_out";
  timestamp: string;
};

export function clockPunch(pin: string, branchSlug: string): Promise<ClockPunchResult> {
  return apiFetch("/api/clock", {
    method: "POST",
    body: JSON.stringify({ pin, branchSlug }),
  });
}
