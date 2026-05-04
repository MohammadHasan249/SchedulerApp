import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { getShifts } from "@/lib/api";
import type { Shift } from "@scheduler/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </Text>
      </View>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <ChevronLeft size={20} color="#94a3b8" />
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
          <ChevronRight size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Shifts list */}
      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadShifts(weekStart); }}
              tintColor="#3b82f6"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: "#f8fafc" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  weekNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  navBtn: { padding: 8 },
  dayStrip: { flexGrow: 0 },
  dayPill: {
    alignItems: "center", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, marginHorizontal: 3, gap: 2,
  },
  dayPillSelected: { backgroundColor: "#1e40af" },
  dayLabel: { fontSize: 11, color: "#64748b", fontWeight: "500" },
  dayLabelSelected: { color: "#93c5fd" },
  dayNum: { fontSize: 16, fontWeight: "600", color: "#cbd5e1" },
  dayNumSelected: { color: "#fff" },
  dayNumToday: { color: "#3b82f6" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#475569" },
  dotSelected: { backgroundColor: "#93c5fd" },
  list: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingTop: 16, paddingBottom: 32, gap: 10 },
  dayHeading: { fontSize: 15, fontWeight: "600", color: "#94a3b8", marginBottom: 4 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#475569", fontSize: 14 },
  card: {
    backgroundColor: "#1e293b", borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderLeftWidth: 3, borderLeftColor: "#3b82f6",
  },
  cardUnpublished: { borderLeftColor: "#64748b", opacity: 0.75 },
  cardTime: { gap: 1 },
  cardTimeText: { fontSize: 14, fontWeight: "600", color: "#f1f5f9" },
  cardTimeSep: { fontSize: 11, color: "#475569", textAlign: "center" },
  cardBody: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHours: { fontSize: 13, color: "#94a3b8" },
  badge: { backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: "#94a3b8", fontWeight: "500" },
});
