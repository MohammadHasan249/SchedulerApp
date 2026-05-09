import { apiFetch } from "./client";

export type JobRole = {
  id: string;
  organizationId: string;
  name: string;
};

export function getJobRoles(): Promise<JobRole[]> {
  return apiFetch("/api/job-roles");
}
