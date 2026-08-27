import { create } from "zustand";
import { getUnreadNotificationCount } from "@/lib/api";

interface NotificationsState {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unreadCount: 0,
  refreshUnreadCount: async () => {
    try {
      const { count } = await getUnreadNotificationCount();
      set({ unreadCount: count });
    } catch {
      // best-effort — badge just stays stale until the next refresh
    }
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
