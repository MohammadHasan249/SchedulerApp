import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, startOfWeek, addDays } from "date-fns";
import {
  getTimeOffRequests, createTimeOffRequest,
  getShiftSwaps, createShiftSwap, updateShiftSwap,
  getShifts,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import type { TimeOffRequest, ShiftSwapRequest, Shift } from "@scheduler/types";

const TIME_OFF_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
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
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setRequests(await getTimeOffRequests());
    } catch {
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
    setSubmitting(true);
    try {
      await createTimeOffRequest({ startDate, endDate, reason: reason || undefined });
      setShowForm(false);
      setStartDate(""); setEndDate(""); setReason("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.newBtnText}>{showForm ? "Cancel" : "+ Request"}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-05-10"
                placeholderTextColor={theme.inactive}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-05-12"
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
              <Text style={styles.emptyText}>No time-off requests</Text>
            </View>
          ) : requests.map((req) => (
            <View key={req.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {format(new Date(req.startDate), "MMM d")} – {format(new Date(req.endDate), "MMM d, yyyy")}
                </Text>
                <View style={[styles.badge, { backgroundColor: TIME_OFF_COLORS[req.status] + "33" }]}>
                  <Text style={[styles.badgeText, { color: TIME_OFF_COLORS[req.status] }]}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Text>
                </View>
              </View>
              {req.reason && <Text style={styles.cardSub}>{req.reason}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

// ─── Swap Shifts ─────────────────────────────────────────────────────────────

function SwapSection() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { session } = useAuthStore();
  const employeeId = session?.user?.user_metadata?.employee_id as string | undefined;

  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, Shift>>({});
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  async function load() {
    try {
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
      setUpcomingShifts(allShifts.filter((s) => new Date(s.startTime) > now));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreateSwap(shiftId: string) {
    setSubmitting(true);
    try {
      await createShiftSwap({ shiftId });
      setShowPicker(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create swap request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(swapId: string) {
    setAccepting(swapId);
    try {
      await updateShiftSwap(swapId, "accept_cover");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to accept swap");
    } finally {
      setAccepting(null);
    }
  }

  return (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowPicker((v) => !v)}>
          <Text style={styles.newBtnText}>{showPicker ? "Cancel" : "+ Request"}</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <View style={styles.form}>
          <Text style={styles.label}>Select a shift to swap</Text>
          {upcomingShifts.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming shifts this fortnight</Text>
          ) : upcomingShifts.map((shift) => (
            <TouchableOpacity
              key={shift.id}
              style={styles.shiftPickerItem}
              onPress={() => Alert.alert(
                "Request Swap",
                `${format(new Date(shift.startTime), "EEE MMM d, h:mm a")} – ${format(new Date(shift.endTime), "h:mm a")}`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Request", onPress: () => handleCreateSwap(shift.id) },
                ]
              )}
            >
              <Text style={styles.shiftPickerDay}>{format(new Date(shift.startTime), "EEE, MMM d")}</Text>
              <Text style={styles.shiftPickerTime}>
                {format(new Date(shift.startTime), "h:mm a")} – {format(new Date(shift.endTime), "h:mm a")}
              </Text>
            </TouchableOpacity>
          ))}
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
          {swaps.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No swap requests</Text>
            </View>
          ) : swaps.map((swap) => {
            const shift = shiftMap[swap.shiftId];
            const isRequester = swap.requesterId === employeeId;
            const isCover = swap.coverId === employeeId;
            const canAccept = isCover && swap.status === "pending";
            return (
              <View key={swap.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {shift
                      ? `${format(new Date(shift.startTime), "EEE MMM d")} · ${format(new Date(shift.startTime), "h:mm a")}–${format(new Date(shift.endTime), "h:mm a")}`
                      : "Shift unavailable"}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: SWAP_COLORS[swap.status] + "33" }]}>
                    <Text style={[styles.badgeText, { color: SWAP_COLORS[swap.status] }]}>
                      {SWAP_LABELS[swap.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  {isRequester ? "You requested" : isCover ? "You're covering" : "Open swap"}
                </Text>
                {canAccept && (
                  <TouchableOpacity
                    style={[styles.acceptBtn, accepting === swap.id && styles.btnDisabled]}
                    onPress={() => handleAccept(swap.id)}
                    disabled={accepting === swap.id}
                  >
                    {accepting === swap.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.acceptBtnText}>Accept Swap</Text>}
                  </TouchableOpacity>
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
    headerRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    newBtn: { backgroundColor: theme.primary + "33", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    newBtnText: { color: theme.primary, fontSize: 13, fontWeight: "600" },
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
  });
}
