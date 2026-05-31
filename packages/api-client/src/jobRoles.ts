import { apiFetch } from "./client";

export type JobRole = {
  id: string;
  organizationId: string;
  name: string;
};

export function getJobRoles(): Promise<JobRole[]> {
  return apiFetch("/api/job-roles");
}

export function createJobRole(name: string): Promise<JobRole> {
  return apiFetch("/api/job-roles", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateJobRole(id: string, name: string): Promise<JobRole> {
  return apiFetch(`/api/job-roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteJobRole(id: string): Promise<void> {
  return apiFetch(`/api/job-roles/${id}`, { method: "DELETE" });
}
