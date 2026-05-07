import { apiFetch } from "./client";

export interface OrganizationHours {
  id: string;
  organizationId: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getOrganizationHours(): Promise<OrganizationHours[]> {
  return apiFetch("/api/settings/hours");
}
