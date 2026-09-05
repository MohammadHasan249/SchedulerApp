import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAvailability, saveAvailability } from "@/lib/api";

export function availabilityQueryKey(employeeId: string) {
  return ["availability", employeeId] as const;
}

export function useAvailabilityQuery(employeeId: string | undefined) {
  return useQuery({
    queryKey: availabilityQueryKey(employeeId ?? ""),
    queryFn: () => getAvailability(employeeId as string),
    enabled: !!employeeId,
  });
}

export function useSaveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, schedule }: { employeeId: string; schedule: Parameters<typeof saveAvailability>[1] }) =>
      saveAvailability(employeeId, schedule),
    onSuccess: (_data, { employeeId }) =>
      queryClient.invalidateQueries({ queryKey: availabilityQueryKey(employeeId) }),
  });
}
