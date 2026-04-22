"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import type { Notification } from "@/db/schema";

type Props = {
  employeeId: string;
  organizationId: string;
};

export function NotificationBell({ employeeId, organizationId }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    // Initial load
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(setNotifs)
      .catch(() => {});

    // Realtime subscription on notifications table filtered by employee_id
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `employee_id=eq.${employeeId}`,
        },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllRead() {
    const unread = notifs.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}`, { method: "PATCH" })));
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v && unreadCount > 0) {
      markAllRead();
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b font-semibold text-sm">Notifications</div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {notifs.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No notifications.</p>
          )}
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`p-3 text-sm cursor-pointer hover:bg-accent ${!n.isRead ? "bg-primary/5" : ""}`}
              onClick={() => !n.isRead && markRead(n.id)}
            >
              <p>{n.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(n.createdAt), "MMM d, HH:mm")}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
