import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAvailability, saveAvailability, getOrganizationHours, type OrganizationHours } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

type DaySlot = { enabled: boolean; startTime: string; endTime: string };

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

export default function AvailabilityScreen() {
  const { session } = useAuthStore();
  const [slots, setSlots] = useState<DaySlot[]>(
    DAYS.map(() => ({ enabled: true, startTime: DEFAULT_START, endTime: DEFAULT_END }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [orgHours, setOrgHours] = useState<OrganizationHours[]>([]);

  useEffect(() => {
    async function load() {
      if (!session) return;
      try {
        // Get organization hours first to use as defaults
        const hours = await getOrganizationHours();
        setOrgHours(hours);

        // Get employee ID from session metadata
        const empId = session.user.user_metadata?.employee_id as string | undefined;
        if (!empId) { setLoading(false); return; }
        setEmployeeId(empId);

        // Get saved employee availability
        const rows = await getAvailability(empId);

        // Build slots: use saved availability if exists, otherwise use org hours as default
        setSlots(
          DAYS.map((_, i) => {
            const savedRow = rows.find((r) => r.dayOfWeek === i);
            if (savedRow) {
              // Use saved availability
              return {
                enabled: true,
                startTime: savedRow.startTime.slice(0, 5),
                endTime: savedRow.endTime.slice(0, 5),
              };
            }

            // Use org hours for this day as default
            const orgHour = hours.find((h) => h.dayOfWeek === i);
            if (orgHour && !orgHour.isClosed && orgHour.startTime && orgHour.endTime) {
              return {
                enabled: true,
                startTime: orgHour.startTime.slice(0, 5),
                endTime: orgHour.endTime.slice(0, 5),
              };
            }

            // Default: enabled with org hours or fallback times
            return {
              enabled: true,
              startTime: orgHour?.startTime?.slice(0, 5) ?? DEFAULT_START,
              endTime: orgHour?.endTime?.slice(0, 5) ?? DEFAULT_END,
            };
          })
        );
      } catch {
        // leave defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  function toggle(i: number) {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function setTime(i: number, key: "startTime" | "endTime", value: string) {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s))
    );
  }

  async function handleSave() {
    if (!employeeId) return;
    setSaving(true);
    try {
      const payload = slots
        .map((s, i) => ({ ...s, dayOfWeek: i }))
        .filter((s) => s.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
      await saveAvailability(employeeId, payload);
      Alert.alert("Saved", "Your availability has been updated.");
    } catch {
      Alert.alert("Error", "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Availability</Text>
        <Text style={styles.subtitle}>Set your weekly schedule</Text>
        {orgHours.length > 0 && (
          <View style={styles.orgHoursInfo}>
            <Text style={styles.orgHoursLabel}>Organization Hours:</Text>
            <Text style={styles.orgHoursText}>
              {orgHours.map((oh, idx) => {
                const day = DAYS[oh.dayOfWeek];
                const hours = oh.isClosed ? 'Closed' : `${oh.startTime} - ${oh.endTime}`;
                return idx === 0 ? `${day}: ${hours}` : `${day}: ${hours}`;
              }).join(' • ')}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {DAYS.map((day, i) => (
          <View key={i} style={styles.row}>
            <TouchableOpacity style={styles.toggle} onPress={() => toggle(i)}>
              <View style={[styles.toggleTrack, slots[i].enabled && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, slots[i].enabled && styles.toggleThumbOn]} />
              </View>
              <Text style={[styles.dayLabel, slots[i].enabled && styles.dayLabelOn]}>
                {day}
              </Text>
            </TouchableOpacity>

            {slots[i].enabled ? (
              <View style={styles.timePickers}>
                <TimeSelect
                  value={slots[i].startTime}
                  onChange={(v) => setTime(i, "startTime", v)}
                />
                <Text style={styles.timeSep}>to</Text>
                <TimeSelect
                  value={slots[i].endTime}
                  onChange={(v) => setTime(i, "endTime", v)}
                />
              </View>
            ) : (
              <Text style={styles.unavailable}>Unavailable</Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Availability</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <ScrollView style={styles.picker} nestedScrollEnabled>
        {TIME_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.pickerItem, t === value && styles.pickerItemSelected]}
            onPress={() => { onChange(t); setOpen(false); }}
          >
            <Text style={[styles.pickerItemText, t === value && styles.pickerItemTextSelected]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }
  return (
    <TouchableOpacity style={styles.timeBtn} onPress={() => setOpen(true)}>
      <Text style={styles.timeBtnText}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: "#f8fafc" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  orgHoursInfo: { marginTop: 12, backgroundColor: "#1e293b", borderRadius: 8, padding: 10 },
  orgHoursLabel: { fontSize: 12, fontWeight: "600", color: "#94a3b8", marginBottom: 4 },
  orgHoursText: { fontSize: 12, color: "#cbd5e1" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 8 },
  row: {
    backgroundColor: "#1e293b", borderRadius: 12, padding: 14,
    gap: 10,
  },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12, backgroundColor: "#334155",
    justifyContent: "center", paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: "#2563eb" },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: "#94a3b8",
  },
  toggleThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
  dayLabel: { fontSize: 15, fontWeight: "500", color: "#64748b" },
  dayLabelOn: { color: "#f1f5f9" },
  timePickers: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 52 },
  timeSep: { color: "#64748b", fontSize: 13 },
  timeBtn: {
    backgroundColor: "#334155", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  timeBtnText: { color: "#f1f5f9", fontSize: 14, fontWeight: "500" },
  picker: { maxHeight: 150, backgroundColor: "#334155", borderRadius: 8, marginLeft: 52 },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8 },
  pickerItemSelected: { backgroundColor: "#1e40af" },
  pickerItemText: { color: "#cbd5e1", fontSize: 14 },
  pickerItemTextSelected: { color: "#fff", fontWeight: "600" },
  unavailable: { color: "#475569", fontSize: 13, paddingLeft: 52 },
  saveBtn: {
    backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
