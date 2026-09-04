import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, startOfWeek, addDays } from "date-fns";
import {
  getTimeOffRequests, createTimeOffRequest, updateTimeOffRequest, cancelTimeOffRequest,
  getShiftSwaps, createShiftSwap, updateShiftSwap,
  getShifts, getShiftAssignments, getEmployees, getBranches, getEligibleCovers,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { useIsAdmin } from "@/lib/useRole";
import { formatZonedTime } from "@/lib/utils/timezone";
import type { TimeOffRequest, ShiftSwapRequest, Shift, Employee } from "@scheduler/types";

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Time-off dates are date-only strings ("2026-06-10"). `new Date()` would
// parse them as UTC midnight and render the previous day in negative-offset
// timezones, so build a local date instead.
function parseDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
}

const TIME_OFF_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#22c55e",
  denied: "#ef4444",
};

const SWAP_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  cover_accepted: "#3b82f6",
  manager_approved: "#22c55e",
  denied: "#ef4444",
};

const SWAP_LABELS: Record<string, string> = {
  pending: "Pending",
  cover_accepted: "Cover Accepted",
  manager_approved: "Approved",
  denied: "Denied",
};

type Segment = "time-off" | "swaps";

export default function RequestsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [segment, setSegment] = useState<Segment>("time-off");

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.segRow}>
        {(["time-off", "swaps"] as Segment[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.seg, segment === s && styles.segActive]}
            onPress={() => setSegment(s)}
          >
            <Text style={[styles.segText, segment === s && styles.segTextActive]}>
              {s === "time-off" ? "Time Off" : "Swap Shifts"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {segment === "time-off" ? <TimeOffSection /> : <SwapSection />}
    </SafeAreaView>
  );
}

// ─── Time Off ────────────────────────────────────────────────────────────────

function TimeOffSection() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isAdmin = useIsAdmin();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    try {
      const reqs = await getTimeOffRequests();
      setRequests(reqs);
      if (isAdmin) {
        const emps = await getEmployees();
        setEmployeeMap(Object.fromEntries(emps.map((e) => [e.id, e])));
      }
    } catch (e) {
      Alert.alert("Couldn't load time-off requests", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit() {
    if (!startDate || !endDate) {
      Alert.alert("Error", "Please fill in start and end dates (YYYY-MM-DD)");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await createTimeOffRequest({ startDate, endDate, reason: reason || undefined });
      setShowForm(false);
      setStartDate(""); setEndDate(""); setReason("");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(id: string, status: "approved" | "denied") {
    setActioning(id);
    try {
      await updateTimeOffRequest(id, { status });
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : `Failed to ${status === "approved" ? "approve" : "deny"} request`);
    } finally {
      setActioning(null);
    }
  }

  async function handleCancel(id: string, status: string) {
    const doCancel = async () => {
      setActioning(id);
      try {
        await cancelTimeOffRequest(id);
        await load();
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Failed to cancel request");
      } finally {
        setActioning(null);
      }
    };
    if (status !== "pending") {
      Alert.alert("Cancel time off?", "This will cancel this time-off request.", [
        { text: "Keep it", style: "cancel" },
        { text: "Cancel request", style: "destructive", onPress: doCancel },
      ]);
    } else {
      await doCancel();
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const decidedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <>
      {!isAdmin && (
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm((v) => !v)}>
            <Text style={styles.newBtnText}>{showForm ? "Cancel" : "+ Request"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAdmin && showForm && (
        <View style={styles.form}>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.inactive}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.inactive}
              />
            </View>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={reason}
            onChangeText={setReason}
            placeholder="Family trip, medical, etc."
            placeholderTextColor={theme.inactive}
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Submit Request</Text>}
          </TouchableOpacity>
        </View>
      )}

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
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {isAdmin ? "No time-off requests from your team" : "No time-off requests"}
              </Text>
            </View>
          ) : (
            <>
              {isAdmin && pendingRequests.length > 0 && (
                <Text style={styles.sectionHeader}>Pending ({pendingRequests.length})</Text>
              )}
              {(isAdmin ? pendingRequests : requests).map((req) => (
                <TimeOffCard
                  key={req.id}
                  req={req}
                  employeeName={isAdmin ? employeeMap[req.employeeId]?.name : undefined}
                  actioning={actioning === req.id}
                  onApprove={isAdmin ? () => handleDecision(req.id, "approved") : undefined}
                  onDeny={isAdmin ? () => handleDecision(req.id, "denied") : undefined}
                  onCancel={!isAdmin ? () => handleCancel(req.id, req.status) : undefined}
                />
              ))}

              {isAdmin && decidedRequests.length > 0 && (
                <Text style={[styles.sectionHeader, { marginTop: 16 }]}>History</Text>
              )}
              {isAdmin && decidedRequests.map((req) => (
                <TimeOffCard
                  key={req.id}
                  req={req}
                  employeeName={employeeMap[req.employeeId]?.name}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}

function TimeOffCard({
  req,
  employeeName,
  actioning,
  onApprove,
  onDeny,
  onCancel,
}: {
  req: TimeOffRequest;
  employeeName?: string;
  actioning?: boolean;
  onApprove?: () => void;
  onDeny?: () => void;
  onCancel?: () => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {format(parseDateOnly(req.startDate), "MMM d")} – {format(parseDateOnly(req.endDate), "MMM d, yyyy")}
        </Text>
        <View style={[styles.badge, { backgroundColor: (TIME_OFF_COLORS[req.status] ?? theme.muted) + "33" }]}>
          <Text style={[styles.badgeText, { color: TIME_OFF_COLORS[req.status] ?? theme.muted }]}>
            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
          </Text>
        </View>
      </View>
      {employeeName && <Text style={styles.cardSub}>{employeeName}</Text>}
      {req.reason && <Text style={styles.cardSub}>{req.reason}</Text>}

      {onApprove && onDeny && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.denyBtn, actioning && styles.btnDisabled]}
            onPress={onDeny}
            disabled={actioning}
          >
            <Text style={styles.denyBtnText}>Deny</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, actioning && styles.btnDisabled]}
            onPress={onApprove}
            disabled={actioning}
          >
            {actioning
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.approveBtnText}>Approve</Text>}
          </TouchableOpacity>
        </View>
      )}

      {onCancel && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.denyBtn, actioning && styles.btnDisabled]}
            onPress={onCancel}
            disabled={actioning}
          >
            {actioning
              ? <ActivityIndicator color={theme.muted} size="small" />
              : <Text style={styles.denyBtnText}>Cancel</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Swap Shifts ─────────────────────────────────────────────────────────────

function SwapSection() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isAdmin = useIsAdmin();
  const { session } = useAuthStore();
  const { fetchMyEmployee } = useMyEmployeeStore();
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);

  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, Shift>>({});
  const [employeeMap, setEmployeeMap] = useState<Record<string, Employee>>({});
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [branchTimezones, setBranchTimezones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [eligibleCovers, setEligibleCovers] = useState<{ id: string; name: string }[]>([]);
  const [loadingCovers, setLoadingCovers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    try {
      const me = session?.user?.id ? await fetchMyEmployee(session.user.id) : null;
      setEmployeeId(me?.id);

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const [swapData, shiftsNow, shiftsNext] = await Promise.all([
        getShiftSwaps(),
        getShifts(weekStart.toISOString()),
        getShifts(addDays(weekStart, 7).toISOString()),
      ]);
      const allShifts = [...shiftsNow, ...shiftsNext];
      const map: Record<string, Shift> = {};
      allShifts.forEach((s) => { map[s.id] = s; });
      const now = new Date();
      setSwaps(swapData);
      setShiftMap(map);

      const upcoming = allShifts.filter((s) => new Date(s.startTime) > now);
      if (isAdmin || !me) {
        setUpcomingShifts(upcoming);
      } else {
        // The shifts list for employees carries no assignment info, so check
        // each upcoming shift — otherwise the picker offers shifts the server
        // will reject with "You are not assigned to this shift".
        const assignmentLists = await Promise.all(
          upcoming.map((s) =>
            s.assignments
              ? Promise.resolve(s.assignments)
              : getShiftAssignments(s.id).catch(() => [])
          )
        );
        setUpcomingShifts(
          upcoming.filter((_, i) => assignmentLists[i].some((a) => a.employeeId === me.id))
        );
      }

      // Needed to label swap cards with names. For admins this is the full
      // org roster; for employees the API only ever returns their own
      // record (see GET /api/employees), which is fine here since employees
      // don't need it for anything but their own name.
      const emps = await getEmployees();
      setEmployeeMap(Object.fromEntries(emps.map((e) => [e.id, e])));

      const brs = await getBranches();
      setBranchTimezones(Object.fromEntries(brs.map((b) => [b.id, b.timezone])));
    } catch (e) {
      Alert.alert("Couldn't load swap requests", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function selectSwapShift(shift: Shift) {
    setSwapShift(shift);
    setLoadingCovers(true);
    try {
      setEligibleCovers(await getEligibleCovers(shift.id));
    } catch (e) {
      Alert.alert("Couldn't load eligible covers", e instanceof Error ? e.message : "Please try again.");
      setEligibleCovers([]);
    } finally {
      setLoadingCovers(false);
    }
  }

  async function handleCreateSwap(shiftId: string, coverId: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createShiftSwap({ shiftId, coverId });
      setShowPicker(false);
      setSwapShift(null);
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create swap request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(swapId: string) {
    setActioning(swapId);
    try {
      await updateShiftSwap(swapId, "accept_cover");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to accept swap");
    } finally {
      setActioning(null);
    }
  }

  async function handleManagerDecision(swapId: string, action: "manager_approve" | "deny") {
    setActioning(swapId);
    try {
      await updateShiftSwap(swapId, action);
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update swap");
    } finally {
      setActioning(null);
    }
  }

  function tzForBranch(branchId: string | undefined | null) {
    return (branchId && branchTimezones[branchId]) ?? DEFAULT_TZ;
  }

  // For admins, sort swaps so cover_accepted (awaiting manager) bubble to top.
  const sortedSwaps = isAdmin
    ? [...swaps].sort((a, b) => {
        const aPri = a.status === "cover_accepted" ? 0 : a.status === "pending" ? 1 : 2;
        const bPri = b.status === "cover_accepted" ? 0 : b.status === "pending" ? 1 : 2;
        return aPri - bPri;
      })
    : swaps;

  return (
    <>
      {!isAdmin && (
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => { setShowPicker((v) => !v); setSwapShift(null); }}
          >
            <Text style={styles.newBtnText}>{showPicker ? "Cancel" : "+ Request"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAdmin && showPicker && !swapShift && (
        <View style={styles.form}>
          <Text style={styles.label}>Select a shift to swap</Text>
          {upcomingShifts.length === 0 ? (
            <Text style={styles.emptyText}>You have no upcoming assigned shifts to swap</Text>
          ) : upcomingShifts.map((shift) => (
            <TouchableOpacity
              key={shift.id}
              testID={`swap-shift-picker-${shift.id}`}
              style={styles.shiftPickerItem}
              onPress={() => selectSwapShift(shift)}
            >
              <Text style={styles.shiftPickerDay}>{format(new Date(shift.startTime), "EEE, MMM d")}</Text>
              <Text style={styles.shiftPickerTime}>
                {formatZonedTime(shift.startTime, tzForBranch(shift.branchId))} – {formatZonedTime(shift.endTime, tzForBranch(shift.branchId))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isAdmin && showPicker && swapShift && (
        <View style={styles.form}>
          <Text style={styles.label}>
            Who should cover {format(new Date(swapShift.startTime), "EEE MMM d,")} {formatZonedTime(swapShift.startTime, tzForBranch(swapShift.branchId))}?
          </Text>
          {loadingCovers ? (
            <ActivityIndicator color={theme.primary} />
          ) : eligibleCovers.length === 0 ? (
            <Text style={styles.emptyText}>No eligible employees at this branch to cover the shift</Text>
          ) : eligibleCovers.map((emp) => (
            <TouchableOpacity
              key={emp.id}
              testID={`swap-cover-picker-${emp.id}`}
              style={styles.shiftPickerItem}
              disabled={submitting}
              onPress={() => Alert.alert(
                "Request Swap",
                `Ask ${emp.name} to cover this shift?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Request", onPress: () => handleCreateSwap(swapShift.id, emp.id) },
                ]
              )}
            >
              <Text style={styles.shiftPickerDay}>{emp.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setSwapShift(null)}>
            <Text style={styles.label}>← Back to shift selection</Text>
          </TouchableOpacity>
        </View>
      )}

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
          {sortedSwaps.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {isAdmin ? "No swap requests from your team" : "No swap requests"}
              </Text>
            </View>
          ) : sortedSwaps.map((swap) => {
            const shift = shiftMap[swap.shiftId];
            const isRequester = swap.requesterId === employeeId;
            const isCover = swap.coverId === employeeId;
            const canAccept = !isAdmin && isCover && swap.status === "pending";
            const canManagerDecide = isAdmin && swap.status === "cover_accepted";
            const requesterName = employeeMap[swap.requesterId]?.name;
            const coverName = swap.coverId ? employeeMap[swap.coverId]?.name : undefined;
            return (
              <View key={swap.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {shift
                      ? `${format(new Date(shift.startTime), "EEE MMM d")} · ${formatZonedTime(shift.startTime, tzForBranch(shift.branchId))}–${formatZonedTime(shift.endTime, tzForBranch(shift.branchId))}`
                      : "Shift unavailable"}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: (SWAP_COLORS[swap.status] ?? theme.muted) + "33" }]}>
                    <Text style={[styles.badgeText, { color: SWAP_COLORS[swap.status] ?? theme.muted }]}>
                      {SWAP_LABELS[swap.status] ?? swap.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  {isAdmin
                    ? `${requesterName ?? "Requester"} → ${coverName ?? "(no cover yet)"}`
                    : isRequester ? "You requested" : isCover ? "You're covering" : "Open swap"}
                </Text>

                {canAccept && (
                  <TouchableOpacity
                    style={[styles.acceptBtn, actioning === swap.id && styles.btnDisabled]}
                    onPress={() => handleAccept(swap.id)}
                    disabled={actioning === swap.id}
                  >
                    {actioning === swap.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.acceptBtnText}>Accept Swap</Text>}
                  </TouchableOpacity>
                )}

                {canManagerDecide && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.denyBtn, actioning === swap.id && styles.btnDisabled]}
                      onPress={() => handleManagerDecision(swap.id, "deny")}
                      disabled={actioning === swap.id}
                    >
                      <Text style={styles.denyBtnText}>Deny</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn, actioning === swap.id && styles.btnDisabled]}
                      onPress={() => handleManagerDecision(swap.id, "manager_approve")}
                      disabled={actioning === swap.id}
                    >
                      {actioning === swap.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.approveBtnText}>Approve</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    segRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 3,
    },
    seg: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    segActive: { backgroundColor: theme.bg },
    segText: { fontSize: 13, fontWeight: "500", color: theme.muted },
    segTextActive: { color: theme.text, fontWeight: "600" },
    headerRow: { position: "absolute", left: 16, bottom: 16, zIndex: 10 },
    newBtn: {
      backgroundColor: theme.primary,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    newBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    form: { marginHorizontal: 16, backgroundColor: theme.surface, borderRadius: 12, padding: 14, gap: 10, marginBottom: 8 },
    formRow: { flexDirection: "row", gap: 10 },
    formField: { flex: 1, gap: 4 },
    label: { fontSize: 13, fontWeight: "500", color: theme.muted },
    input: {
      backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.surface2,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: theme.textSecondary,
    },
    inputMulti: { height: 60, textAlignVertical: "top" },
    submitBtn: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    btnDisabled: { opacity: 0.6 },
    submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    shiftPickerItem: {
      backgroundColor: theme.bg, borderRadius: 8, padding: 10,
      borderWidth: 1, borderColor: theme.surface2,
    },
    shiftPickerDay: { fontSize: 14, fontWeight: "600", color: theme.textSecondary },
    shiftPickerTime: { fontSize: 12, color: theme.muted, marginTop: 2 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
    sectionHeader: { fontSize: 12, fontWeight: "600", color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4, paddingTop: 4 },
    empty: { alignItems: "center", paddingVertical: 48 },
    emptyText: { color: theme.inactive, fontSize: 14 },
    card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, gap: 6 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: 14, fontWeight: "600", color: theme.textSecondary, flex: 1 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 12, fontWeight: "600" },
    cardSub: { fontSize: 13, color: theme.muted },
    acceptBtn: { backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 4 },
    acceptBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    actionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
    actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
    approveBtn: { backgroundColor: "#22c55e" },
    approveBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    denyBtn: { backgroundColor: theme.surface2 },
    denyBtnText: { color: theme.destructive, fontSize: 13, fontWeight: "600" },
  });
}
