import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTimeOffRequests, createTimeOffRequest, updateTimeOffRequest, cancelTimeOffRequest,
} from "@/lib/api";

export const timeOffQueryKey = ["timeOffRequests"] as const;

export function useTimeOffRequestsQuery() {
  return useQuery({
    queryKey: timeOffQueryKey,
    queryFn: getTimeOffRequests,
  });
}

function useInvalidateTimeOff() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: timeOffQueryKey });
}

export function useCreateTimeOffRequest() {
  const invalidateTimeOff = useInvalidateTimeOff();
  return useMutation({
    mutationFn: (input: Parameters<typeof createTimeOffRequest>[0]) => createTimeOffRequest(input),
    onSuccess: invalidateTimeOff,
  });
}

export function useUpdateTimeOffRequest() {
  const invalidateTimeOff = useInvalidateTimeOff();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "denied" }) =>
      updateTimeOffRequest(id, { status }),
    onSuccess: invalidateTimeOff,
  });
}

export function useCancelTimeOffRequest() {
  const invalidateTimeOff = useInvalidateTimeOff();
  return useMutation({
    mutationFn: (id: string) => cancelTimeOffRequest(id),
    onSuccess: invalidateTimeOff,
  });
}
