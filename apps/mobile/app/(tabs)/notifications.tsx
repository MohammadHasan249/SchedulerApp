import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "date-fns";
import { getNotifications, markNotificationRead } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Notification } from "@scheduler/types";

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const rows = await getNotifications();
      setNotifs(rows);
    } catch (e) {
      Alert.alert("Couldn't load notifications", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handlePress(n: Notification) {
    if (n.isRead) return;
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
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
            notifs.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.isRead && styles.cardUnread]}
                onPress={() => handlePress(n)}
                activeOpacity={n.isRead ? 1 : 0.7}
              >
                <Text style={styles.message}>{n.message}</Text>
                <Text style={styles.timestamp}>{format(new Date(n.createdAt), "MMM d, h:mm a")}</Text>
              </TouchableOpacity>
            ))
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
  });
}
