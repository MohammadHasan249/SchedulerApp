import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { Users, CalendarCheck, Clock } from "lucide-react-native";
import { getDashboardStats, type DashboardStats } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatCard({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: theme.surface }]}>
      {icon}
      <Text style={[statStyles.value, { color: theme.text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  value: { fontSize: 28, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "500", textAlign: "center" },
});

export default function DashboardScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Clocked In"
                value={stats.clockedInCount}
                icon={<Users size={22} color={theme.primary} />}
                theme={theme}
              />
              <View style={styles.statGap} />
              <StatCard
                label="Shifts Today"
                value={stats.totalShiftsToday}
                icon={<CalendarCheck size={22} color={theme.primary} />}
                theme={theme}
              />
              <View style={styles.statGap} />
              <StatCard
                label="Pending Time Off"
                value={stats.pendingTimeOffCount}
                icon={<Clock size={22} color={theme.primary} />}
                theme={theme}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Shifts</Text>
              {stats.todayShifts.length === 0 ? (
                <Text style={styles.empty}>No shifts scheduled today.</Text>
              ) : (
                stats.todayShifts.map((shift) => (
                  <View key={shift.id} style={styles.shiftRow}>
                    <Text style={styles.shiftName}>
                      {shift.employeeName ?? "Unassigned"}
                    </Text>
                    <Text style={styles.shiftTime}>
                      {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
    title: { fontSize: 26, fontWeight: "700", color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 2 },
    statsRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    statGap: { width: 10 },
    section: {
      marginHorizontal: 20,
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    shiftRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    shiftName: { fontSize: 14, color: theme.textSecondary, flex: 1 },
    shiftTime: { fontSize: 13, color: theme.muted, fontWeight: "500" },
    empty: {
      fontSize: 14,
      color: theme.muted,
      padding: 16,
      textAlign: "center",
    },
  });
}
