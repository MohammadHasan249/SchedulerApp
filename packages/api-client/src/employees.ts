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

export async function getEmployees(): Promise<Employee[]> {
  // GET /api/employees returns a paginated envelope { data, nextCursor }, not a
  // bare array. Unwrap to the rows so callers get the array they expect.
  // (Only the first page — up to PAGE_SIZE — is surfaced; pagination isn't
  // wired through the client yet.)
  const res = await apiFetch<{ data: Employee[]; nextCursor: string | null }>(
    "/api/employees"
  );
  return res.data ?? [];
}

export function getEmployee(id: string): Promise<Employee & { pinHash?: string | null }> {
  return apiFetch(`/api/employees/${id}`);
}

export function deleteEmployee(id: string): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`, { method: "DELETE" });
}

export type InviteEmployeeResult = Employee & { emailSent: boolean };

export function inviteEmployee(payload: InviteEmployeePayload): Promise<InviteEmployeeResult> {
  return apiFetch("/api/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployee(
  id: string,
  data: Partial<
    Pick<
      Employee,
      "name" | "isActive" | "branchId" | "jobRoleId" | "maxHoursPerWeek" | "permissionProfileId"
    >
  >
): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateEmployeePin(
  employeeId: string,
  pin: string
): Promise<{ success: boolean; name: string }> {
  return apiFetch(`/api/employees/${employeeId}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pin }),
  });
}
