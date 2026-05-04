import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "date-fns";
import { getTimeOffRequests, createTimeOffRequest } from "@/lib/api";
import type { TimeOffRequest } from "@scheduler/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
};

export default function TimeOffScreen() {
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
      const data = await getTimeOffRequests();
      setRequests(data);
    } catch {
      // no-op
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Time Off</Text>
          <Text style={styles.subtitle}>Manage your requests</Text>
        </View>
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
                placeholderTextColor="#475569"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-05-12"
                placeholderTextColor="#475569"
              />
            </View>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={reason}
            onChangeText={setReason}
            placeholder="Family trip, medical, etc."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={2}
          />
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Submit Request</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#3b82f6" />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No time-off requests</Text>
            </View>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDates}>
                    {format(new Date(req.startDate), "MMM d")} – {format(new Date(req.endDate), "MMM d, yyyy")}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLORS[req.status] + "33" }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLORS[req.status] }]}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {req.reason && <Text style={styles.cardReason}>{req.reason}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: "#f8fafc" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  newBtn: { backgroundColor: "#1e40af", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  newBtnText: { color: "#93c5fd", fontSize: 13, fontWeight: "600" },
  form: { marginHorizontal: 16, backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 10, marginBottom: 8 },
  formRow: { flexDirection: "row", gap: 10 },
  formField: { flex: 1, gap: 4 },
  label: { fontSize: 13, fontWeight: "500", color: "#94a3b8" },
  input: { backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: "#f1f5f9" },
  inputMulti: { height: 60, textAlignVertical: "top" },
  submitBtn: { backgroundColor: "#3b82f6", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#475569", fontSize: 14 },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 6 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDates: { fontSize: 15, fontWeight: "600", color: "#f1f5f9" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  cardReason: { fontSize: 13, color: "#94a3b8" },
});
