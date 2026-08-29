import { apiFetch } from "./client";

export type DashboardStats = {
  clockedInCount: number;
  totalShiftsToday: number;
  pendingTimeOffCount: number;
  todayShifts: Array<{
    id: string;
    startTime: string;
    endTime: string;
    employeeName: string | null;
    /** IANA timezone of the shift's branch. */
    timezone: string;
  }>;
};

export function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch("/api/dashboard/stats");
}
