import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getShifts, assignEmployee, unassignEmployee, createShift,
  deleteShift, publishShifts, updateShift,
} from "@/lib/api";
import type { Shift } from "@scheduler/types";

export function shiftsQueryKey(weekStart: string) {
  return ["shifts", weekStart] as const;
}

export function useShiftsQuery(weekStartISO: string) {
  return useQuery({
    queryKey: shiftsQueryKey(weekStartISO),
    queryFn: () => getShifts(weekStartISO),
  });
}

function useInvalidateShifts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["shifts"] });
}

export function useAssignEmployee() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ shiftId, employeeId }: { shiftId: string; employeeId: string }) =>
      assignEmployee(shiftId, employeeId),
    onSuccess: invalidateShifts,
  });
}

export function useUnassignEmployee() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ shiftId, assignmentId }: { shiftId: string; assignmentId: string }) =>
      unassignEmployee(shiftId, assignmentId),
    onSuccess: invalidateShifts,
  });
}

export function useCreateShift() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: (input: Parameters<typeof createShift>[0]) => createShift(input),
    onSuccess: invalidateShifts,
  });
}

export function useUpdateShift() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ shiftId, input }: { shiftId: string; input: Parameters<typeof updateShift>[1] }) =>
      updateShift(shiftId, input),
    onSuccess: invalidateShifts,
  });
}

export function useDeleteShift() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: (shiftId: string) => deleteShift(shiftId),
    onSuccess: invalidateShifts,
  });
}

export function usePublishShifts() {
  const invalidateShifts = useInvalidateShifts();
  return useMutation({
    mutationFn: ({ branchId, weekStartISO }: { branchId: string; weekStartISO: string }) =>
      publishShifts(branchId, weekStartISO),
    onSuccess: invalidateShifts,
  });
}

export type { Shift };
