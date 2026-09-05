import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPayRates, createPayRate } from "@/lib/api";

export function payRatesQueryKey(employeeId: string) {
  return ["payRates", employeeId] as const;
}

export function usePayRatesQuery(employeeId: string | undefined) {
  return useQuery({
    queryKey: payRatesQueryKey(employeeId ?? ""),
    queryFn: () => getPayRates(employeeId as string),
    enabled: !!employeeId,
  });
}

export function useCreatePayRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: Parameters<typeof createPayRate>[1] }) =>
      createPayRate(employeeId, payload),
    onSuccess: (_data, { employeeId }) =>
      queryClient.invalidateQueries({ queryKey: payRatesQueryKey(employeeId) }),
  });
}
