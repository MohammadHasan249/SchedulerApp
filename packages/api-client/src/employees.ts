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
  // GET /api/employees returns a paginated envelope { data, nextCursor }.
  // Callers treat this as "the full roster" (pickers, kiosk PIN matching,
  // myEmployeeStore's own-record lookup), so follow the cursor to the end
  // rather than silently truncating orgs with more employees than one page.
  const all: Employee[] = [];
  let cursor: string | null = null;
  // Hard stop well past any plausible org size, in case of a server bug
  // that never advances the cursor.
  for (let page = 0; page < 100; page++) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const res: { data: Employee[]; nextCursor: string | null } = await apiFetch(
      `/api/employees${query}`
    );
    all.push(...(res.data ?? []));
    if (!res.nextCursor || res.nextCursor === cursor) break;
    cursor = res.nextCursor;
  }
  return all;
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
