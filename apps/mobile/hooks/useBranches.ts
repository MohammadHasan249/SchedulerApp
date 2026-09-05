import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranches, createBranch, updateBranch, deleteBranch, type Branch } from "@/lib/api";

export const branchesQueryKey = ["branches"] as const;

export function useBranchesQuery() {
  return useQuery({
    queryKey: branchesQueryKey,
    queryFn: getBranches,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createBranch>[0]) => createBranch(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Branch[]>(branchesQueryKey, (old) => (old ? [...old, created] : [created]));
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateBranch>[1] }) =>
      updateBranch(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Branch[]>(branchesQueryKey, (old) =>
        old?.map((b) => (b.id === updated.id ? updated : b))
      );
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Branch[]>(branchesQueryKey, (old) => old?.filter((b) => b.id !== id));
    },
  });
}
