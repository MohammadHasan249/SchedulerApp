import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobRoles, createJobRole, updateJobRole, deleteJobRole } from "@/lib/api";

export const jobRolesQueryKey = ["jobRoles"] as const;

export function useJobRolesQuery() {
  return useQuery({
    queryKey: jobRolesQueryKey,
    queryFn: getJobRoles,
  });
}

function useInvalidateJobRoles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: jobRolesQueryKey });
}

export function useCreateJobRole() {
  const invalidateJobRoles = useInvalidateJobRoles();
  return useMutation({
    mutationFn: (name: string) => createJobRole(name),
    onSuccess: invalidateJobRoles,
  });
}

export function useUpdateJobRole() {
  const invalidateJobRoles = useInvalidateJobRoles();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateJobRole(id, name),
    onSuccess: invalidateJobRoles,
  });
}

export function useDeleteJobRole() {
  const invalidateJobRoles = useInvalidateJobRoles();
  return useMutation({
    mutationFn: (id: string) => deleteJobRole(id),
    onSuccess: invalidateJobRoles,
  });
}
