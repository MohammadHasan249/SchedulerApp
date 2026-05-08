import { apiFetch } from "./client";

export type Branch = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
};

export type CreateBranchPayload = {
  name: string;
  slug?: string;
  address?: string;
  timezone?: string;
};

export type UpdateBranchPayload = Partial<CreateBranchPayload>;

export function getBranches(): Promise<Branch[]> {
  return apiFetch("/api/branches");
}

export function createBranch(payload: CreateBranchPayload): Promise<Branch> {
  return apiFetch("/api/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBranch(id: string, payload: UpdateBranchPayload): Promise<Branch> {
  return apiFetch(`/api/branches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteBranch(id: string): Promise<void> {
  return apiFetch(`/api/branches/${id}`, { method: "DELETE" });
}
