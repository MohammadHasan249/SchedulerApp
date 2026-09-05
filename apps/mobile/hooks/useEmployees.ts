import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEmployees, getEmployee, inviteEmployee, updateEmployee, deleteEmployee, updateEmployeePin,
} from "@/lib/api";
import type { Employee } from "@scheduler/types";

export const employeesQueryKey = ["employees"] as const;
export function employeeQueryKey(id: string) {
  return ["employees", id] as const;
}

export function useEmployeesQuery(enabled = true) {
  return useQuery({
    queryKey: employeesQueryKey,
    queryFn: getEmployees,
    enabled,
  });
}

export function useEmployeeQuery(id: string | undefined) {
  return useQuery({
    queryKey: employeeQueryKey(id ?? ""),
    queryFn: () => getEmployee(id as string),
    enabled: !!id,
  });
}

// The server never writes employee_id into Supabase user metadata, so the
// only reliable way to find "my" employee record is matching authUserId
// against the roster `useEmployeesQuery` already fetches (the API scopes
// that list to just the caller's own record for non-admins), so this shares
// its cache/dedup rather than firing a second request.
export function useMyEmployeeQuery(authUserId: string | undefined) {
  const query = useEmployeesQuery(!!authUserId);
  const employee = query.data?.find((e) => e.authUserId === authUserId) ?? null;
  return { ...query, data: employee };
}

function useInvalidateEmployees() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: employeesQueryKey });
}

export function useInviteEmployee() {
  const invalidateEmployees = useInvalidateEmployees();
  return useMutation({
    mutationFn: (input: Parameters<typeof inviteEmployee>[0]) => inviteEmployee(input),
    onSuccess: invalidateEmployees,
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateEmployee>[1] }) =>
      updateEmployee(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: employeesQueryKey });
      const previousList = queryClient.getQueryData<Employee[]>(employeesQueryKey);
      const previousDetail = queryClient.getQueryData<Employee>(employeeQueryKey(id));
      queryClient.setQueryData<Employee[]>(employeesQueryKey, (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...input } : e))
      );
      queryClient.setQueryData<Employee>(employeeQueryKey(id), (old) => (old ? { ...old, ...input } : old));
      return { previousList, previousDetail, id };
    },
    onSuccess: (updated, { id, input }) => {
      // The API's response shape isn't reliable everywhere it's mocked/used,
      // so merge input+response over the existing record rather than
      // replacing it outright (spreading a possibly-undefined `updated` is a
      // safe no-op).
      queryClient.setQueryData<Employee[]>(employeesQueryKey, (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...input, ...updated } : e))
      );
      queryClient.setQueryData<Employee>(employeeQueryKey(id), (old) =>
        old ? { ...old, ...input, ...updated } : old
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) queryClient.setQueryData(employeesQueryKey, context.previousList);
      if (context?.previousDetail) queryClient.setQueryData(employeeQueryKey(context.id), context.previousDetail);
    },
  });
}

// deleteEmployee is a soft-delete (isActive: false) but its response isn't
// reliable enough to trust as the new cache value, so patch that flag
// directly rather than replacing the cached record with the response.
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Employee[]>(employeesQueryKey, (old) =>
        old?.map((e) => (e.id === id ? { ...e, isActive: false } : e))
      );
      queryClient.setQueryData<Employee>(employeeQueryKey(id), (old) =>
        old ? { ...old, isActive: false } : old
      );
    },
  });
}

export function useUpdateEmployeePin() {
  const invalidateEmployees = useInvalidateEmployees();
  return useMutation({
    mutationFn: ({ employeeId, pin }: { employeeId: string; pin: string }) =>
      updateEmployeePin(employeeId, pin),
    onSuccess: invalidateEmployees,
  });
}
