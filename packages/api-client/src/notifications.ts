import { apiFetch } from "./client";
import type { Notification } from "@scheduler/types";

export function getNotifications(): Promise<Notification[]> {
  return apiFetch("/api/notifications");
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
}

export function registerPushToken(token: string): Promise<void> {
  return apiFetch("/api/push-tokens", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function unregisterPushToken(token: string): Promise<void> {
  return apiFetch("/api/push-tokens", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
