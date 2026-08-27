import { apiFetch } from "./client";
import type { Notification } from "@scheduler/types";

export function getNotifications(opts: { limit?: number; offset?: number } = {}): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return apiFetch(`/api/notifications${qs ? `?${qs}` : ""}`);
}

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetch("/api/notifications?unreadCount=true");
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
