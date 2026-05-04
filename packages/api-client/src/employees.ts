import { apiFetch } from "./client";
import type { Employee } from "@scheduler/types";

export function getEmployees(): Promise<Employee[]> {
  return apiFetch("/api/employees");
}

export function updateEmployee(
  id: string,
  data: Partial<Pick<Employee, "name" | "isActive" | "branchId" | "jobRoleId" | "maxHoursPerWeek">>
): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
