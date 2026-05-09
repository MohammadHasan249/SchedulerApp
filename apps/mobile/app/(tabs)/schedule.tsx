import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { getShifts, getEmployees } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useIsAdmin } from "@/lib/useRole";
import type { Shift, Employee } from "@scheduler/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isAdmin = useIsAdmin();
  const [view, setView] = useState<"shifts" | "availability">("shifts");
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
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

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (view === "shifts") {
      setLoading(true);
      loadShifts(weekStart);
    } else {
      setLoading(true);
      loadEmployees().finally(() => setLoading(false));
    }
  }, [weekStart, view]);

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

  function onRefresh() {
    setRefreshing(true);
    if (view === "shifts") {
      loadShifts(weekStart);
    } else {
      loadEmployees().finally(() => setRefreshing(false));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </Text>
        {isAdmin && (
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, view === "shifts" && styles.toggleBtnActive]}
              onPress={() => setView("shifts")}
            >
              <Text style={[styles.toggleText, view === "shifts" && styles.toggleTextActive]}>
                Shifts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, view === "availability" && styles.toggleBtnActive]}
              onPress={() => setView("availability")}
            >
              <Text style={[styles.toggleText, view === "availability" && styles.toggleTextActive]}>
                Availability
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
            const hasShifts = view === "shifts" && shifts.some((s) => isSameDay(new Date(s.startTime), day));
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

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : view === "shifts" ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
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
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          <Text style={styles.dayHeading}>{format(selectedDay, "EEEE, MMMM d")}</Text>
          {employees.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            employees.map((emp) => (
              <AvailabilityRow key={emp.id} employee={emp} day={selectedDay} />
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

function AvailabilityRow({ employee, day }: { employee: Employee; day: Date }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const dow = getDay(day); // 0 = Sunday
  const slot = employee.availabilitySchedule?.[String(dow)];

  function fmt(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.cardTimeText}>{employee.name}</Text>
        {slot ? (
          <Text style={[styles.availTime, { color: theme.primary }]}>
            {fmt(slot.startTime)} – {fmt(slot.endTime)}
          </Text>
        ) : (
          <Text style={styles.unavailable}>Unavailable</Text>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 10 },
    subtitle: { fontSize: 13, color: theme.secondary },
    toggle: {
      flexDirection: "row",
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 3,
      alignSelf: "flex-start",
    },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: theme.primary },
    toggleText: { fontSize: 13, fontWeight: "500", color: theme.muted },
    toggleTextActive: { color: "#fff" },
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
    availTime: { fontSize: 13, fontWeight: "500" },
    unavailable: { fontSize: 13, color: theme.inactive },
  });
}
