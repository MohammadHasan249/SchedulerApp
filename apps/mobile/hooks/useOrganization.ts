import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganizationInfo, getOrganizationHours, updateOrganizationHours, getOrganizationTheme, updateOrganizationTheme } from "@/lib/api";

export const organizationInfoQueryKey = ["organizationInfo"] as const;
export const organizationHoursQueryKey = ["organizationHours"] as const;
export const organizationThemeQueryKey = ["organizationTheme"] as const;

export function useOrganizationInfoQuery(enabled = true) {
  return useQuery({
    queryKey: organizationInfoQueryKey,
    queryFn: getOrganizationInfo,
    enabled,
  });
}

export function useOrganizationHoursQuery() {
  return useQuery({
    queryKey: organizationHoursQueryKey,
    queryFn: getOrganizationHours,
  });
}

export function useUpdateOrganizationHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: Parameters<typeof updateOrganizationHours>[0]) => updateOrganizationHours(schedule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationHoursQueryKey }),
  });
}

export function useOrganizationThemeQuery(enabled = true) {
  return useQuery({
    queryKey: organizationThemeQueryKey,
    queryFn: getOrganizationTheme,
    enabled,
  });
}

export function useUpdateOrganizationTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: Parameters<typeof updateOrganizationTheme>[0]) => updateOrganizationTheme(theme),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationThemeQueryKey }),
  });
}
