import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getNotifications, markNotificationRead } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useNotificationsStore } from "@/lib/notificationsStore";
import { formatZonedDateTime } from "@/lib/utils/timezone";
import type { Notification } from "@scheduler/types";

const PAGE_SIZE = 5;
// Notifications don't carry a branch id, so there's no reliable branch
// timezone to convert into — fall back to the device's own timezone.
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { refreshUnreadCount } = useNotificationsStore();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function load() {
    try {
      const rows = await getNotifications({ limit: PAGE_SIZE, offset: 0 });
      setNotifs(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      Alert.alert("Couldn't load notifications", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const rows = await getNotifications({ limit: PAGE_SIZE, offset: notifs.length });
      setNotifs((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      Alert.alert("Couldn't load more notifications", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
    refreshUnreadCount();
  }, []);

  async function handlePress(n: Notification) {
    if (n.isRead) return;
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    refreshUnreadCount();
    try {
      await markNotificationRead(n.id);
    } catch {
      // best-effort — leave optimistic state; next refresh reconciles
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={theme.primary}
            />
          }
        >
          {notifs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          ) : (
            <>
              {notifs.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.card, !n.isRead && styles.cardUnread]}
                  onPress={() => handlePress(n)}
                  activeOpacity={n.isRead ? 1 : 0.7}
                >
                  <Text style={styles.message}>{n.message}</Text>
                  <Text style={styles.timestamp}>{formatZonedDateTime(n.createdAt, DEVICE_TZ)}</Text>
                </TouchableOpacity>
              ))}
              {hasMore && (
                <TouchableOpacity
                  style={styles.seeMore}
                  onPress={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={[styles.seeMoreText, { color: theme.primary }]}>See more</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    empty: { alignItems: "center", paddingVertical: 48 },
    emptyText: { color: theme.inactive, fontSize: 14 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, gap: 4 },
    cardUnread: { backgroundColor: theme.primarySurface },
    message: { fontSize: 14, color: theme.textSecondary },
    timestamp: { fontSize: 12, color: theme.muted },
    seeMore: { alignItems: "center", paddingVertical: 14 },
    seeMoreText: { fontSize: 14, fontWeight: "600" },
  });
}
