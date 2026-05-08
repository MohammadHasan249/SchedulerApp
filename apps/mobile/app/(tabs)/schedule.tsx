import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { getShifts } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Shift } from "@scheduler/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadShifts = useCallback(async (start: Date) => {
    try {
      const data = await getShifts(start.toISOString());
      setShifts(data);
    } catch {
      // silent — no shifts shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadShifts(weekStart);
  }, [weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayShifts = shifts.filter((s) =>
    isSameDay(new Date(s.startTime), selectedDay)
  );

  function prevWeek() {
    const prev = addDays(weekStart, -7);
    setWeekStart(prev);
    setSelectedDay(prev);
  }

  function nextWeek() {
    const next = addDays(weekStart, 7);
    setWeekStart(next);
    setSelectedDay(next);
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </Text>
      </View>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <ChevronLeft size={20} color={theme.muted} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip}>
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());
            const hasShifts = shifts.some((s) => isSameDay(new Date(s.startTime), day));
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayPill, isSelected && styles.dayPillSelected]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                  {DAY_LABELS[i]}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && styles.dayNumToday]}>
                  {format(day, "d")}
                </Text>
                {hasShifts && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
          <ChevronRight size={20} color={theme.muted} />
        </TouchableOpacity>
      </View>

      {/* Shifts list */}
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadShifts(weekStart); }}
              tintColor={theme.primary}
            />
          }
        >
          <Text style={styles.dayHeading}>{format(selectedDay, "EEEE, MMMM d")}</Text>
          {dayShifts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No shifts scheduled</Text>
            </View>
          ) : (
            dayShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ShiftCard({ shift }: { shift: Shift }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  return (
    <View style={[styles.card, !shift.isPublished && styles.cardUnpublished]}>
      <View style={styles.cardTime}>
        <Text style={styles.cardTimeText}>{format(start, "h:mm a")}</Text>
        <Text style={styles.cardTimeSep}>–</Text>
        <Text style={styles.cardTimeText}>{format(end, "h:mm a")}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardHours}>{hours}h shift</Text>
        {!shift.isPublished && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Draft</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
    subtitle: { fontSize: 13, color: theme.secondary },
    weekNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
    navBtn: { padding: 8 },
    dayStrip: { flexGrow: 0 },
    dayPill: {
      alignItems: "center", paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 10, marginHorizontal: 3, gap: 2,
    },
    dayPillSelected: { backgroundColor: theme.primary + "44" },
    dayLabel: { fontSize: 11, color: theme.secondary, fontWeight: "500" },
    dayLabelSelected: { color: theme.primary },
    dayNum: { fontSize: 16, fontWeight: "600", color: theme.textSecondary },
    dayNumSelected: { color: "#fff" },
    dayNumToday: { color: theme.primary },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.inactive },
    dotSelected: { backgroundColor: theme.primary },
    list: { flex: 1, paddingHorizontal: 16 },
    listContent: { paddingTop: 16, paddingBottom: 32, gap: 10 },
    dayHeading: { fontSize: 15, fontWeight: "600", color: theme.muted, marginBottom: 4 },
    empty: { alignItems: "center", paddingVertical: 48 },
    emptyText: { color: theme.inactive, fontSize: 14 },
    card: {
      backgroundColor: theme.surface, borderRadius: 12, padding: 14,
      flexDirection: "row", alignItems: "center", gap: 12,
      borderLeftWidth: 3, borderLeftColor: theme.primary,
    },
    cardUnpublished: { borderLeftColor: theme.secondary, opacity: 0.75 },
    cardTime: { gap: 1 },
    cardTimeText: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
    cardTimeSep: { fontSize: 11, color: theme.inactive, textAlign: "center" },
    cardBody: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardHours: { fontSize: 13, color: theme.muted },
    badge: { backgroundColor: theme.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, color: theme.muted, fontWeight: "500" },
  });
}
