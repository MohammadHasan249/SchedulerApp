import { apiFetch } from "./client";
import type { Employee } from "@scheduler/types";

export type InviteEmployeePayload = {
  name: string;
  email: string;
  role?: "org_admin" | "branch_manager" | "employee";
  branchId?: string | null;
  maxHoursPerWeek?: number;
  pin?: string;
};

export function getEmployees(): Promise<Employee[]> {
  return apiFetch("/api/employees");
}

export function inviteEmployee(payload: InviteEmployeePayload): Promise<Employee> {
  return apiFetch("/api/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
