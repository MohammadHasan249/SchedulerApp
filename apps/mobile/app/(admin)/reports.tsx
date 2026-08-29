import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react-native";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import {
  getClockEvents,
  getBranches,
  type ClockEventRow,
  type Branch,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { formatZonedTime } from "@/lib/utils/timezone";

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function ReportsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [day, setDay] = useState(new Date());
  const [rows, setRows] = useState<ClockEventRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = startOfDay(day).toISOString();
      const to = endOfDay(day).toISOString();
      const data = await getClockEvents({
        from,
        to,
        ...(branchId !== "all" ? { branchId } : {}),
      });
      setRows(data);
    } catch (e) {
      Alert.alert("Couldn't load attendance", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [day, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
  }, []);

  function shiftDay(delta: number) {
    setDay((d) => addDays(d, delta));
  }

  const branchTimezones = Object.fromEntries(branches.map((b) => [b.id, b.timezone]));

  return (
    <>
      <Stack.Screen options={{ title: "Attendance" }} />
      <View style={styles.container}>
        <View style={styles.dayBar}>
          <TouchableOpacity
            onPress={() => shiftDay(-1)}
            style={styles.dayBtn}
            accessibilityLabel="Previous day"
          >
            <ChevronLeft size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.dayLabel}>{format(day, "EEEE, MMM d, yyyy")}</Text>
          <TouchableOpacity
            onPress={() => shiftDay(1)}
            style={styles.dayBtn}
            accessibilityLabel="Next day"
          >
            <ChevronRight size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {branches.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.branchRow}
          >
            <TouchableOpacity
              style={[styles.chip, branchId === "all" && styles.chipActive]}
              onPress={() => setBranchId("all")}
            >
              <Text style={[styles.chipText, branchId === "all" && styles.chipTextActive]}>
                All branches
              </Text>
            </TouchableOpacity>
            {branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.chip, branchId === b.id && styles.chipActive]}
                onPress={() => setBranchId(b.id)}
              >
                <Text style={[styles.chipText, branchId === b.id && styles.chipTextActive]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={theme.primary}
              />
            }
          >
            {rows.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No clock-in/out events for this day.</Text>
              </View>
            ) : (
              rows.map((row) => {
                const isIn = row.event.type === "clock_in";
                return (
                  <View key={row.event.id} style={styles.row}>
                    <View
                      style={[
                        styles.iconBubble,
                        { backgroundColor: (isIn ? theme.primary : theme.secondary) + "22" },
                      ]}
                    >
                      {isIn ? (
                        <LogIn size={16} color={theme.primary} />
                      ) : (
                        <LogOut size={16} color={theme.secondary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{row.employee.name}</Text>
                      <Text style={styles.empMeta}>
                        {isIn ? "Clocked in" : "Clocked out"}
                      </Text>
                    </View>
                    <Text style={styles.time}>
                      {formatZonedTime(row.event.timestamp, branchTimezones[row.event.branchId] ?? DEFAULT_TZ)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    dayBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    dayBtn: { padding: 8 },
    dayLabel: { fontSize: 14, fontWeight: "600", color: theme.text },
    branchRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.surface,
      marginRight: 8,
    },
    chipActive: { backgroundColor: theme.primary },
    chipText: { fontSize: 13, color: theme.textSecondary },
    chipTextActive: { color: "#fff", fontWeight: "600" },
    list: { padding: 16, gap: 8 },
    empty: { paddingVertical: 64, alignItems: "center" },
    emptyText: { color: theme.muted, fontSize: 14 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
    },
    iconBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    empName: { fontSize: 14, fontWeight: "600", color: theme.text },
    empMeta: { fontSize: 12, color: theme.muted, marginTop: 1 },
    time: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
  });
}
