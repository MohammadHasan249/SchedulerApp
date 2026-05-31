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

export type ClockEventRow = {
  event: {
    id: string;
    employeeId: string;
    branchId: string;
    type: "clock_in" | "clock_out";
    timestamp: string;
  };
  employee: {
    id: string;
    name: string;
    email: string;
  };
};

export function getClockEvents(opts?: {
  branchId?: string;
  from?: string;
  to?: string;
}): Promise<ClockEventRow[]> {
  const params = new URLSearchParams();
  if (opts?.branchId) params.set("branchId", opts.branchId);
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const qs = params.toString();
  return apiFetch(`/api/clock${qs ? `?${qs}` : ""}`);
}
