import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/api";

export const dashboardStatsQueryKey = ["dashboardStats"] as const;

export function useDashboardStatsQuery() {
  return useQuery({
    queryKey: dashboardStatsQueryKey,
    queryFn: getDashboardStats,
  });
}
