import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, FlatList, Pressable, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Bot, X, Plus, UserMinus, Trash2, Send } from "lucide-react-native";
import { format, addDays, startOfWeek, isSameDay, getDay } from "date-fns";
import { useRouter, useFocusEffect } from "expo-router";
import {
  getShifts, getEmployees, assignEmployee, unassignEmployee, getJobRoles,
  createShift, getBranches, deleteShift, publishShifts, type Branch,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { useIsAdmin, useBranchId } from "@/lib/useRole";
import { BranchSelector } from "@/components/BranchSelector";
import { formatZonedTime } from "@/lib/utils/timezone";
import type { Shift, Employee, ShiftAssignmentDetail } from "@scheduler/types";

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isAdmin = useIsAdmin();
  const myBranchId = useBranchId();
  const router = useRouter();
  const { session } = useAuthStore();
  const { fetchMyEmployee } = useMyEmployeeStore();
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

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

  // Branch (org admins can manage multiple)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(myBranchId);

  // Create-shift modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<string | null>(null);
  const [createStart, setCreateStart] = useState("09:00");
  const [createEnd, setCreateEnd] = useState("17:00");
  const [createAssignedIds, setCreateAssignedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [timePickerFor, setTimePickerFor] = useState<"start" | "end" | null>(null);

  const loadShifts = useCallback(async (start: Date) => {
    try {
      const data = await getShifts(start.toISOString());
      setShifts(data);
    } catch (e) {
      Alert.alert("Couldn't load shifts", e instanceof Error ? e.message : "Please try again.");
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const [data, roles] = await Promise.all([getEmployees(), getJobRoles()]);
      setTeamEmployees(data);
      setRoleMap(new Map(roles.map((r) => [r.id, r.name])));
    } catch (e) {
      Alert.alert("Couldn't load team", e instanceof Error ? e.message : "Please try again.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [loadShifts(weekStart)];
    if (isAdmin) tasks.push(loadEmployees());
    Promise.all(tasks).finally(() => setLoading(false));
  }, [weekStart]);

  // Org admins oversee multiple branches — load the list once and default
  // the selection to the admin's own branch, or the first branch otherwise.
  useEffect(() => {
    if (!isAdmin || myBranchId) return;
    getBranches()
      .then((brs) => {
        setBranches(brs);
        setSelectedBranchId((prev) => prev ?? brs[0]?.id ?? null);
      })
      .catch(() => {});
  }, [isAdmin, myBranchId]);

  // Employees: resolve own record so their shifts can be highlighted.
  useEffect(() => {
    if (!isAdmin && session?.user?.id) {
      fetchMyEmployee(session.user.id).then((me) => setMyEmployeeId(me?.id ?? null));
    }
  }, [session, isAdmin]);

  // Silently refresh when the screen regains focus (e.g. returning from the
  // AI assign screen) so new assignments show up without a manual pull.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      loadShifts(weekStart);
    }, [weekStart, loadShifts])
  );

  // Reload employees once when switching to availability
  useEffect(() => {
    if (isAdmin && view === "availability" && teamEmployees.length === 0) {
      loadEmployees();
    }
  }, [view]);

  // Employees (non-admins) never fetch the branch list, so fall back to the
  // device timezone when we don't have branch-local timezone info on hand.
  function tzForBranch(branchId: string | undefined | null) {
    return branches.find((b) => b.id === branchId)?.timezone ?? DEFAULT_TZ;
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const branchEmployees = selectedBranchId
    ? teamEmployees.filter((e) => e.branchId === selectedBranchId)
    : teamEmployees;
  const dayShifts = shifts.filter(
    (s) => isSameDay(new Date(s.startTime), selectedDay) && (!selectedBranchId || s.branchId === selectedBranchId)
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
    } catch (e) {
      Alert.alert("Couldn't assign", e instanceof Error ? e.message : "Please try again.");
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
    } catch (e) {
      Alert.alert("Couldn't unassign", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setModalAssigning(false);
    }
  }

  const [publishing, setPublishing] = useState(false);

  function confirmDeleteShift(shift: Shift) {
    Alert.alert("Delete shift?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setModalAssigning(true);
          try {
            await deleteShift(shift.id);
            setSelectedShift(null);
            const updated = await getShifts(weekStart.toISOString());
            setShifts(updated);
          } catch (e) {
            Alert.alert("Couldn't delete shift", e instanceof Error ? e.message : "Please try again.");
          } finally {
            setModalAssigning(false);
          }
        },
      },
    ]);
  }

  async function handlePublishWeek() {
    if (!selectedBranchId || publishing) return;
    setPublishing(true);
    try {
      await publishShifts(selectedBranchId, weekStart.toISOString());
      const updated = await getShifts(weekStart.toISOString());
      setShifts(updated);
    } catch (e) {
      Alert.alert("Couldn't publish shifts", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  const assignedIds = new Set((selectedShift?.assignments ?? []).map((a) => a.employeeId));
  const unassignedEmployees = teamEmployees.filter(
    (e) => e.role !== "org_admin" && e.branchId === selectedShift?.branchId && !assignedIds.has(e.id)
  );

  function openCreateShift() {
    setCreateError("");
    setCreateStart("09:00");
    setCreateEnd("17:00");
    setCreateAssignedIds([]);
    setCreateBranchId(selectedBranchId ?? branches[0]?.id ?? null);
    if (teamEmployees.length === 0) loadEmployees();
    setCreateOpen(true);
  }

  function toggleCreateAssign(id: string) {
    setCreateAssignedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreateShift() {
    if (!createBranchId) {
      setCreateError("No branch selected");
      return;
    }
    if (createStart >= createEnd) {
      setCreateError("End time must be after start time");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const dateStr = format(selectedDay, "yyyy-MM-dd");
      const startISO = new Date(`${dateStr}T${createStart}:00`).toISOString();
      const endISO = new Date(`${dateStr}T${createEnd}:00`).toISOString();
      const newShift = await createShift({ branchId: createBranchId, startTime: startISO, endTime: endISO });
      for (const empId of createAssignedIds) {
        await assignEmployee(newShift.id, empId);
      }
      const updated = await getShifts(weekStart.toISOString());
      setShifts(updated);
      setCreateOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setCreating(false);
    }
  }

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
        {isAdmin && (
          <BranchSelector branches={branches} value={selectedBranchId} onChange={setSelectedBranchId} />
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
          <View style={styles.dayHeadingRow}>
            <Text style={styles.dayHeading}>{format(selectedDay, "EEEE, MMMM d")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {isAdmin && dayShifts.some((s) => !s.isPublished) && (
                <TouchableOpacity
                  style={styles.addShiftBtn}
                  onPress={handlePublishWeek}
                  disabled={publishing}
                >
                  {publishing ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <Send size={14} color={theme.primary} />
                      <Text style={styles.addShiftBtnText}>Publish</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity style={styles.addShiftBtn} onPress={openCreateShift}>
                  <Plus size={14} color={theme.primary} />
                  <Text style={styles.addShiftBtnText}>Add Shift</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {dayShifts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No shifts scheduled</Text>
              {isAdmin && (
                <TouchableOpacity style={[styles.addShiftBtn, { marginTop: 12 }]} onPress={openCreateShift}>
                  <Plus size={14} color={theme.primary} />
                  <Text style={styles.addShiftBtnText}>Add Shift</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            dayShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                isAdmin={isAdmin}
                myEmployeeId={myEmployeeId}
                timezone={tzForBranch(shift.branchId)}
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
          {branchEmployees.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No employees found</Text>
            </View>
          ) : (
            branchEmployees
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
                      {formatZonedTime(selectedShift.startTime, tzForBranch(selectedShift.branchId))} –{" "}
                      {formatZonedTime(selectedShift.endTime, tzForBranch(selectedShift.branchId))} ·{" "}
                      {format(new Date(selectedShift.startTime), "EEE, MMM d")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => confirmDeleteShift(selectedShift)}
                      disabled={modalAssigning}
                      accessibilityLabel="Delete shift"
                    >
                      <Trash2 size={20} color="#e5484d" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedShift(null)}>
                      <X size={22} color={theme.muted} />
                    </TouchableOpacity>
                  </View>
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
                        accessibilityLabel={`Remove ${a.employeeName}`}
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
                            accessibilityLabel={`Add ${emp.name}`}
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

      {/* Create shift modal */}
      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCreateOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Shift</Text>
                <Text style={styles.modalSub}>{format(selectedDay, "EEE, MMM d")}</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateOpen(false)}>
                <X size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>

            {branches.length > 1 && (
              <>
                <Text style={styles.sectionLabel}>Branch</Text>
                <BranchSelector
                  branches={branches}
                  value={createBranchId}
                  onChange={setCreateBranchId}
                />
              </>
            )}

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Start</Text>
                <TouchableOpacity style={styles.timeInput} onPress={() => setTimePickerFor("start")}>
                  <Text style={{ fontSize: 15, color: theme.text }}>{createStart}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>End</Text>
                <TouchableOpacity style={styles.timeInput} onPress={() => setTimePickerFor("end")}>
                  <Text style={{ fontSize: 15, color: theme.text }}>{createEnd}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Assign Employees</Text>
            <FlatList
              data={teamEmployees.filter(
                (e) => e.role !== "org_admin" && e.branchId === createBranchId
              )}
              keyExtractor={(e) => e.id}
              scrollEnabled={false}
              ListEmptyComponent={<Text style={styles.emptyText}>No employees found</Text>}
              renderItem={({ item: emp }) => (
                <TouchableOpacity
                  style={styles.assignedRow}
                  onPress={() => toggleCreateAssign(emp.id)}
                >
                  <Text style={styles.assignedName}>{emp.name}</Text>
                  <View
                    style={[
                      styles.checkbox,
                      createAssignedIds.includes(emp.id) && styles.checkboxChecked,
                    ]}
                  >
                    {createAssignedIds.includes(emp.id) && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              )}
            />

            {createError !== "" && <Text style={styles.errorText}>{createError}</Text>}

            <TouchableOpacity
              style={[styles.createBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreateShift}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>Create Shift</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time picker (wheel-based, no keyboard) */}
      <Modal
        visible={timePickerFor !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setTimePickerFor(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTimePickerFor(null)}>
          <Pressable style={styles.timePickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{timePickerFor === "start" ? "Start Time" : "End Time"}</Text>
            <TimeWheelPicker
              theme={theme}
              value={timePickerFor === "start" ? createStart : createEnd}
              onChange={(v) => {
                if (timePickerFor === "start") setCreateStart(v);
                else setCreateEnd(v);
              }}
            />
            <TouchableOpacity
              style={[styles.createBtn, { alignSelf: "stretch" }]}
              onPress={() => setTimePickerFor(null)}
            >
              <Text style={styles.createBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function TimeWheelPicker({
  theme,
  value,
  onChange,
}: {
  theme: ReturnType<typeof useAppTheme>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [hh, mm] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  return (
    <View style={{ flexDirection: "row", gap: 16, marginVertical: 16 }}>
      <FlatList
        data={hours}
        keyExtractor={(h) => h}
        style={{ maxHeight: 220 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: h }) => (
          <TouchableOpacity
            style={{ paddingVertical: 10, alignItems: "center" }}
            onPress={() => onChange(`${h}:${mm}`)}
          >
            <Text style={{ fontSize: 18, fontWeight: h === hh ? "700" : "400", color: h === hh ? theme.primary : theme.text }}>
              {h}
            </Text>
          </TouchableOpacity>
        )}
      />
      <Text style={{ fontSize: 18, color: theme.text, alignSelf: "center" }}>:</Text>
      <FlatList
        data={minutes}
        keyExtractor={(m) => m}
        style={{ maxHeight: 220 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: m }) => (
          <TouchableOpacity
            style={{ paddingVertical: 10, alignItems: "center" }}
            onPress={() => onChange(`${hh}:${m}`)}
          >
            <Text style={{ fontSize: 18, fontWeight: m === mm ? "700" : "400", color: m === mm ? theme.primary : theme.text }}>
              {m}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ShiftCard({
  shift,
  isAdmin,
  myEmployeeId,
  timezone,
  onPress,
}: {
  shift: Shift;
  isAdmin: boolean;
  myEmployeeId?: string | null;
  timezone: string;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const hours = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
  const assignments = shift.assignments ?? [];
  const isMine = !!myEmployeeId && assignments.some((a) => a.employeeId === myEmployeeId);

  const card = (
    <View style={[styles.card, !shift.isPublished && styles.cardUnpublished]}>
      <View style={styles.cardTime}>
        <Text style={styles.cardTimeText}>{formatZonedTime(shift.startTime, timezone)}</Text>
        <Text style={styles.cardTimeSep}>–</Text>
        <Text style={styles.cardTimeText}>{formatZonedTime(shift.endTime, timezone)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardHours}>{hours}h shift</Text>
            {isMine && (
              <View style={[styles.badge, { backgroundColor: theme.primary + "33" }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>Your shift</Text>
              </View>
            )}
            {!shift.isPublished && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Draft</Text>
              </View>
            )}
          </View>
          {assignments.length > 0 && (
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
    dayHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    addShiftBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      borderWidth: 1.5, borderColor: theme.primary, borderRadius: 16,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    addShiftBtnText: { fontSize: 12, fontWeight: "600", color: theme.primary },
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
      flex: 1, backgroundColor: theme.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40, maxHeight: "80%",
    },
    timePickerSheet: {
      backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 40, alignItems: "center",
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
    timeRow: { flexDirection: "row", gap: 12 },
    timeInput: {
      borderWidth: 1, borderColor: theme.surface2, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: theme.text,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 5,
      borderWidth: 1.5, borderColor: theme.inactive,
      alignItems: "center", justifyContent: "center",
    },
    checkboxChecked: { backgroundColor: theme.primary, borderColor: theme.primary },
    checkboxMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
    errorText: { color: "#e5484d", fontSize: 13, marginTop: 10 },
    createBtn: {
      backgroundColor: theme.primary, borderRadius: 10,
      paddingVertical: 12, alignItems: "center", marginTop: 18,
    },
    createBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
