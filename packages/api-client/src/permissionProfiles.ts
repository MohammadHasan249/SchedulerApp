import { apiFetch } from "./client";
import type { PermissionProfile, PermissionKey } from "@scheduler/types";

export function getPermissionProfiles(): Promise<PermissionProfile[]> {
  return apiFetch("/api/permission-profiles");
}

export function createPermissionProfile(payload: {
  name: string;
  permissions: PermissionKey[];
}): Promise<PermissionProfile> {
  return apiFetch("/api/permission-profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePermissionProfile(
  id: string,
  payload: { name?: string; permissions?: PermissionKey[] }
): Promise<PermissionProfile> {
  return apiFetch(`/api/permission-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePermissionProfile(id: string): Promise<void> {
  return apiFetch(`/api/permission-profiles/${id}`, { method: "DELETE" });
}

/** The caller's own effective permission keys (for gating UI). */
export async function getMyPermissions(): Promise<PermissionKey[]> {
  const res = await apiFetch<{ permissions: PermissionKey[] }>("/api/me/permissions");
  return res.permissions ?? [];
}
