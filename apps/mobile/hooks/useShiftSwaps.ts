import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShiftSwaps, createShiftSwap, updateShiftSwap } from "@/lib/api";

export const shiftSwapsQueryKey = ["shiftSwaps"] as const;

export function useShiftSwapsQuery() {
  return useQuery({
    queryKey: shiftSwapsQueryKey,
    queryFn: getShiftSwaps,
  });
}

function useInvalidateShiftSwaps() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: shiftSwapsQueryKey });
}

export function useCreateShiftSwap() {
  const invalidateShiftSwaps = useInvalidateShiftSwaps();
  return useMutation({
    mutationFn: (input: Parameters<typeof createShiftSwap>[0]) => createShiftSwap(input),
    onSuccess: invalidateShiftSwaps,
  });
}

export function useUpdateShiftSwap() {
  const invalidateShiftSwaps = useInvalidateShiftSwaps();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept_cover" | "manager_approve" | "deny" }) =>
      updateShiftSwap(id, action),
    onSuccess: invalidateShiftSwaps,
  });
}
