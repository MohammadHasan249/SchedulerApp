import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPermissionProfiles, createPermissionProfile, updatePermissionProfile, deletePermissionProfile,
} from "@/lib/api";
import type { PermissionProfile } from "@scheduler/types";
import { employeesQueryKey } from "@/hooks/useEmployees";

export const permissionProfilesQueryKey = ["permissionProfiles"] as const;

export function usePermissionProfilesQuery() {
  return useQuery({
    queryKey: permissionProfilesQueryKey,
    queryFn: getPermissionProfiles,
  });
}

export function useCreatePermissionProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPermissionProfile>[0]) => createPermissionProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: permissionProfilesQueryKey }),
  });
}

export function useUpdatePermissionProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updatePermissionProfile>[1] }) =>
      updatePermissionProfile(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: permissionProfilesQueryKey });
      const previous = queryClient.getQueryData<PermissionProfile[]>(permissionProfilesQueryKey);
      queryClient.setQueryData<PermissionProfile[]>(permissionProfilesQueryKey, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...input } : p))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(permissionProfilesQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: permissionProfilesQueryKey }),
  });
}

export function useDeletePermissionProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePermissionProfile(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: permissionProfilesQueryKey });
      await queryClient.cancelQueries({ queryKey: employeesQueryKey });
      const previousProfiles = queryClient.getQueryData<PermissionProfile[]>(permissionProfilesQueryKey);
      const previousEmployees = queryClient.getQueryData(employeesQueryKey);
      queryClient.setQueryData<PermissionProfile[]>(permissionProfilesQueryKey, (old) =>
        old?.filter((p) => p.id !== id)
      );
      queryClient.setQueryData<{ permissionProfileId: string | null }[]>(employeesQueryKey, (old) =>
        old?.map((e) => (e.permissionProfileId === id ? { ...e, permissionProfileId: null } : e))
      );
      return { previousProfiles, previousEmployees };
    },
    onError: (_err, _id, context) => {
      if (context?.previousProfiles) queryClient.setQueryData(permissionProfilesQueryKey, context.previousProfiles);
      if (context?.previousEmployees) queryClient.setQueryData(employeesQueryKey, context.previousEmployees);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: permissionProfilesQueryKey });
      queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    },
  });
}
