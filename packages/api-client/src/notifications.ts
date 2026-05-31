import { apiFetch } from "./client";
import type { Notification } from "@scheduler/types";

export function getNotifications(): Promise<Notification[]> {
  return apiFetch("/api/notifications");
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
}
