import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications, getUnreadNotificationCount, markNotificationRead,
  registerPushToken, unregisterPushToken,
} from "@/lib/api";
import type { Notification } from "@scheduler/types";

export const notificationsQueryKey = ["notifications"] as const;
export const unreadNotificationCountQueryKey = ["notifications", "unreadCount"] as const;

export function useNotificationsQuery(opts: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: [...notificationsQueryKey, opts],
    queryFn: () => getNotifications(opts),
  });
}

const NOTIFICATIONS_PAGE_SIZE = 5;

export function useNotificationsInfiniteQuery() {
  return useInfiniteQuery({
    queryKey: [...notificationsQueryKey, "infinite"],
    queryFn: ({ pageParam }) => getNotifications({ limit: NOTIFICATIONS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === NOTIFICATIONS_PAGE_SIZE ? pages.flat().length : undefined,
  });
}

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: unreadNotificationCountQueryKey,
    queryFn: getUnreadNotificationCount,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const infiniteKey = [...notificationsQueryKey, "infinite"];
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      queryClient.setQueryData<{ pages: Notification[][]; pageParams: unknown[] }>(infiniteKey, (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) => page.map((n) => (n.id === id ? { ...n, isRead: true } : n))),
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: infiniteKey });
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey });
    },
  });
}

export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (token: string) => registerPushToken(token),
  });
}

export function useUnregisterPushToken() {
  return useMutation({
    mutationFn: (token: string) => unregisterPushToken(token),
  });
}
