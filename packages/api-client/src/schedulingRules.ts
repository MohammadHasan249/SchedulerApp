import { apiFetch } from "./client";

export type SchedulingRule = {
  id: string;
  branchId: string;
  ruleText: string;
  isActive: boolean;
  createdAt: string;
};

export function getSchedulingRules(branchId: string): Promise<SchedulingRule[]> {
  return apiFetch(`/api/settings/scheduling-rules?branchId=${branchId}`);
}

export function createSchedulingRule(branchId: string, ruleText: string): Promise<SchedulingRule> {
  return apiFetch("/api/settings/scheduling-rules", {
    method: "POST",
    body: JSON.stringify({ branchId, ruleText }),
  });
}

export function updateSchedulingRule(
  id: string,
  updates: { ruleText?: string; isActive?: boolean }
): Promise<SchedulingRule> {
  return apiFetch(`/api/settings/scheduling-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteSchedulingRule(id: string): Promise<void> {
  return apiFetch(`/api/settings/scheduling-rules/${id}`, { method: "DELETE" });
}
