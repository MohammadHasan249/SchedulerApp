import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, FlatList, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Bot, X, Plus, UserMinus } from "lucide-react-native";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { useRouter } from "expo-router";
import {
  getShifts, getEmployees, assignEmployee, unassignEmployee, getJobRoles,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useIsAdmin } from "@/lib/useRole";
import type { Shift, Employee, ShiftAssignmentDetail } from "@scheduler/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isAdmin = useIsAdmin();
  const router = useRouter();

  const [view, setView] = useState<"shifts" | "availability">("shifts");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<Employee[]>([]);
  const [roleMap, setRoleMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assignment modal
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [modalAssigning, setModalAssigning] = useState(false);

  const loadShifts = useCallback(async (start: Date) => {
    try {
      const data = await getShifts(start.toISOString());
      setShifts(data);
    } catch {
      // silent
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const [data, roles] = await Promise.all([getEmployees(), getJobRoles()]);
      setTeamEmployees(data);
      setRoleMap(new Map(roles.map((r) => [r.id, r.name])));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [loadShifts(weekStart)];
    if (isAdmin) tasks.push(loadEmployees());
    Promise.all(tasks).finally(() => setLoading(false));
  }, [weekStart]);

  // Reload employees once when switching to availability
  useEffect(() => {
    if (isAdmin && view === "availability" && teamEmployees.length === 0) {
      loadEmployees();
    }
  }, [view]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayShifts = shifts.filter((s) => isSameDay(new Date(s.startTime), selectedDay));

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
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadShifts(weekStart), isAdmin ? loadEmployees() : Promise.resolve()]);
    setRefreshing(false);
  }

  async function handleAssign(shift: Shift, employeeId: string) {
    setModalAssigning(true);
    try {
      await assignEmployee(shift.id, employeeId);
      const updated = await getShifts(weekStart.toISOString());
      setShifts(updated);
      setSelectedShift(updated.find((s) => s.id === shift.id) ?? null);
    } catch {
      // silent
    } finally {
      setModalAssigning(false);
    }
  }

  async function handleUnassign(shift: Shift, assignmentId: string) {
    setModalAssigning(true);
    try {
      await unassignEmployee(shift.id, assignmentId);
      const updated = await getShifts(weekStart.toISOString());
      setShifts(updated);
      setSelectedShift(updated.find((s) => s.id === shift.id) ?? null);
    } catch {
      // silent
    } finally {
      setModalAssigning(false);
    }
  }

  const assignedIds = new Set((selectedShift?.assignments ?? []).map((a) => a.employeeId));
  const unassignedEmployees = teamEmployees.filter(
    (e) => e.role === "employee" && !assignedIds.has(e.id)
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </Text>
          {isAdmin && view === "shifts" && (
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={() => router.push("/(admin)/schedule-ai")}
            >
              <Bot size={15} color="#fff" />
              <Text style={styles.aiBtnText}>AI Assign</Text>
            </TouchableOpacity>
          )}
        </View>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          <Text style={styles.dayHeading}>{format(selectedDay, "EEEE, MMMM d")}</Text>
          {dayShifts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No shifts scheduled</Text>
            </View>
          ) : (
            dayShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                isAdmin={isAdmin}
                onPress={() => { setSelectedShift(shift); }}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          <Text style={styles.dayHeading}>{format(selectedDay, "EEEE, MMMM d")}</Text>
          {teamEmployees.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            teamEmployees
              .filter((emp) => emp.role !== "org_admin")
              .map((emp) => (
                <AvailabilityRow key={emp.id} employee={emp} day={selectedDay} roleMap={roleMap} />
              ))
          )}
        </ScrollView>
      )}

      {/* Assignment modal */}
      <Modal
        visible={selectedShift !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedShift(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedShift(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedShift && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Shift Assignments</Text>
                    <Text style={styles.modalSub}>
                      {format(new Date(selectedShift.startTime), "h:mm a")} –{" "}
                      {format(new Date(selectedShift.endTime), "h:mm a")} ·{" "}
                      {format(new Date(selectedShift.startTime), "EEE, MMM d")}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedShift(null)}>
                    <X size={22} color={theme.muted} />
                  </TouchableOpacity>
                </View>

                {modalAssigning && (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 8 }} />
                )}

                {/* Current assignments */}
                <Text style={styles.sectionLabel}>
                  Assigned ({selectedShift.assignments?.length ?? 0})
                </Text>
                {(selectedShift.assignments ?? []).length === 0 ? (
                  <Text style={styles.emptyText}>No one assigned yet</Text>
                ) : (
                  (selectedShift.assignments ?? []).map((a) => (
                    <View key={a.id} style={styles.assignedRow}>
                      <Text style={styles.assignedName}>{a.employeeName}</Text>
                      <TouchableOpacity
                        onPress={() => handleUnassign(selectedShift, a.id)}
                        disabled={modalAssigning}
                      >
                        <UserMinus size={18} color={theme.inactive} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* Add employee */}
                {unassignedEmployees.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Add Employee</Text>
                    <FlatList
                      data={unassignedEmployees}
                      keyExtractor={(e) => e.id}
                      scrollEnabled={false}
                      renderItem={({ item: emp }) => (
                        <View style={styles.assignedRow}>
                          <Text style={styles.assignedName}>{emp.name}</Text>
                          <TouchableOpacity
                            style={styles.plusBtn}
                            onPress={() => handleAssign(selectedShift, emp.id)}
                            disabled={modalAssigning}
                          >
                            <Plus size={16} color={theme.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ShiftCard({
  shift,
  isAdmin,
  onPress,
}: {
  shift: Shift;
  isAdmin: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const assignments = shift.assignments ?? [];

  const card = (
    <View style={[styles.card, !shift.isPublished && styles.cardUnpublished]}>
      <View style={styles.cardTime}>
        <Text style={styles.cardTimeText}>{format(start, "h:mm a")}</Text>
        <Text style={styles.cardTimeSep}>–</Text>
        <Text style={styles.cardTimeText}>{format(end, "h:mm a")}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardHours}>{hours}h shift</Text>
            {!shift.isPublished && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Draft</Text>
              </View>
            )}
          </View>
          {isAdmin && assignments.length > 0 && (
            <Text style={styles.assignedChips} numberOfLines={1}>
              {assignments.map((a) => a.employeeName).join(", ")}
            </Text>
          )}
          {isAdmin && assignments.length === 0 && (
            <Text style={styles.unassignedHint}>Tap to assign employees</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (!isAdmin) return card;
  return <TouchableOpacity onPress={onPress}>{card}</TouchableOpacity>;
}

function AvailabilityRow({
  employee,
  day,
  roleMap,
}: {
  employee: Employee;
  day: Date;
  roleMap: Map<string, string>;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const dow = getDay(day);
  const slot = employee.availabilitySchedule?.[String(dow)];
  const roleName = employee.jobRoleId ? roleMap.get(employee.jobRoleId) : null;

  function fmt(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <View style={{ gap: 2 }}>
          <Text style={styles.cardTimeText}>{employee.name}</Text>
          {roleName && <Text style={styles.roleLabel}>{roleName}</Text>}
        </View>
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
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    subtitle: { fontSize: 13, color: theme.secondary },
    aiBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: theme.primary, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    aiBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
    toggle: {
      flexDirection: "row", backgroundColor: theme.surface,
      borderRadius: 10, padding: 3, alignSelf: "flex-start",
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
    cardBody: { flex: 1, gap: 2 },
    cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardHours: { fontSize: 13, color: theme.muted },
    badge: { backgroundColor: theme.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, color: theme.muted, fontWeight: "500" },
    assignedChips: { fontSize: 12, color: theme.primary, fontWeight: "500" },
    unassignedHint: { fontSize: 12, color: theme.inactive, fontStyle: "italic" },
    availTime: { fontSize: 13, fontWeight: "500" },
    unavailable: { fontSize: 13, color: theme.inactive },
    roleLabel: { fontSize: 12, color: theme.muted },
    // Modal
    modalBackdrop: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40, maxHeight: "80%",
    },
    modalHeader: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "flex-start", marginBottom: 20,
    },
    modalTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
    modalSub: { fontSize: 13, color: theme.muted, marginTop: 2 },
    sectionLabel: { fontSize: 12, fontWeight: "600", color: theme.secondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
    assignedRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.surface,
    },
    assignedName: { fontSize: 15, color: theme.text },
    plusBtn: {
      width: 28, height: 28, borderRadius: 14,
      borderWidth: 1.5, borderColor: theme.primary,
      alignItems: "center", justifyContent: "center",
    },
  });
}
