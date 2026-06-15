import { apiFetch } from "./client";
import type { PermissionKey } from "@scheduler/types";

/** The caller's own effective permission keys (for gating UI). */
export async function getMyPermissions(): Promise<PermissionKey[]> {
  const res = await apiFetch<{ permissions: PermissionKey[] }>("/api/me/permissions");
  return res.permissions ?? [];
}
