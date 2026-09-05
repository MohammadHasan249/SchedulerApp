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
      const previous = queryClient.getQueryData<Employee[]>(employeesQueryKey);
      queryClient.setQueryData<Employee[]>(employeesQueryKey, (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...input } : e))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(employeesQueryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: employeesQueryKey }),
  });
}

export function useDeleteEmployee() {
  const invalidateEmployees = useInvalidateEmployees();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: invalidateEmployees,
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
