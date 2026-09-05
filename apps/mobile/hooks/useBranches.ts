import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranches, createBranch, updateBranch, deleteBranch } from "@/lib/api";

export const branchesQueryKey = ["branches"] as const;

export function useBranchesQuery() {
  return useQuery({
    queryKey: branchesQueryKey,
    queryFn: getBranches,
  });
}

function useInvalidateBranches() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: branchesQueryKey });
}

export function useCreateBranch() {
  const invalidateBranches = useInvalidateBranches();
  return useMutation({
    mutationFn: (input: Parameters<typeof createBranch>[0]) => createBranch(input),
    onSuccess: invalidateBranches,
  });
}

export function useUpdateBranch() {
  const invalidateBranches = useInvalidateBranches();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBranch>[1] }) =>
      updateBranch(id, input),
    onSuccess: invalidateBranches,
  });
}

export function useDeleteBranch() {
  const invalidateBranches = useInvalidateBranches();
  return useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: invalidateBranches,
  });
}
