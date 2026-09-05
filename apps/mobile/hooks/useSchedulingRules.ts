import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSchedulingRules, createSchedulingRule, updateSchedulingRule, deleteSchedulingRule,
} from "@/lib/api";

export function schedulingRulesQueryKey(branchId: string) {
  return ["schedulingRules", branchId] as const;
}

export function useSchedulingRulesQuery(branchId: string | null) {
  return useQuery({
    queryKey: schedulingRulesQueryKey(branchId ?? ""),
    queryFn: () => getSchedulingRules(branchId as string),
    enabled: !!branchId,
  });
}

function useInvalidateSchedulingRules() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["schedulingRules"] });
}

export function useCreateSchedulingRule() {
  const invalidate = useInvalidateSchedulingRules();
  return useMutation({
    mutationFn: ({ branchId, ruleText }: { branchId: string; ruleText: string }) =>
      createSchedulingRule(branchId, ruleText),
    onSuccess: invalidate,
  });
}

export function useUpdateSchedulingRule() {
  const invalidate = useInvalidateSchedulingRules();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSchedulingRule>[1] }) =>
      updateSchedulingRule(id, updates),
    onSuccess: invalidate,
  });
}

export function useDeleteSchedulingRule() {
  const invalidate = useInvalidateSchedulingRules();
  return useMutation({
    mutationFn: (id: string) => deleteSchedulingRule(id),
    onSuccess: invalidate,
  });
}
