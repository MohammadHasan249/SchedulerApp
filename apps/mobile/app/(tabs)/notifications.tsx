import { useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { useNotificationsInfiniteQuery, useMarkNotificationRead } from "@/hooks/useNotifications";
import { formatZonedDateTime } from "@/lib/utils/timezone";
import type { Notification } from "@scheduler/types";

// Notifications don't carry a branch id, so there's no reliable branch
// timezone to convert into — fall back to the device's own timezone.
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const query = useNotificationsInfiniteQuery();
  const markReadMutation = useMarkNotificationRead();
  const notifs = query.data?.pages.flat() ?? [];
  const loading = query.isLoading;
  const loadingMore = query.isFetchingNextPage;
  const refreshing = query.isRefetching && !query.isFetchingNextPage;
  const hasMore = query.hasNextPage;

  useEffect(() => {
    if (query.error) {
      Alert.alert("Couldn't load notifications", query.error instanceof Error ? query.error.message : "Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  // Silently refresh on subsequent focuses (e.g. returning after a manager
  // approves a request) so the list doesn't go stale while the tab stays mounted.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function handlePress(n: Notification) {
    if (n.isRead) return;
    markReadMutation.mutate(n.id);
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
              onRefresh={() => query.refetch()}
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
                  onPress={() => query.fetchNextPage()}
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
