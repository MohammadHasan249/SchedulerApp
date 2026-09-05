import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrganizationHoursQuery } from "@/hooks/useOrganization";
import { useAvailabilityQuery, useSaveAvailability } from "@/hooks/useAvailability";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { useAppTheme } from "@/lib/useAppTheme";

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
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { session } = useAuthStore();
  const { fetchMyEmployee } = useMyEmployeeStore();
  const [slots, setSlots] = useState<DaySlot[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [noEmployee, setNoEmployee] = useState(false);

  const hoursQuery = useOrganizationHoursQuery();
  const availabilityQuery = useAvailabilityQuery(employeeId ?? undefined);
  const saveMutation = useSaveAvailability();
  const loading = !noEmployee && (employeeId === null || hoursQuery.isLoading || availabilityQuery.isLoading || !slots);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchMyEmployee(session.user.id).then((me) => {
      if (!me) {
        Alert.alert(
          "No employee profile",
          "Your account isn't linked to an employee record. Ask your manager to re-invite you."
        );
        setNoEmployee(true);
        return;
      }
      setEmployeeId(me.id);
    });
  }, [session]);

  useEffect(() => {
    if (!hoursQuery.data || !availabilityQuery.data) return;
    const hours = hoursQuery.data;
    const schedule = availabilityQuery.data;
    setSlots(
      DAYS.map((_, i) => {
        const saved = schedule[i];
        if (saved) {
          return {
            enabled: true,
            startTime: saved.startTime.slice(0, 5),
            endTime: saved.endTime.slice(0, 5),
          };
        }
        const orgSlot = hours[i.toString()];
        return {
          enabled: !!orgSlot,
          startTime: orgSlot?.startTime ?? DEFAULT_START,
          endTime: orgSlot?.endTime ?? DEFAULT_END,
        };
      })
    );
  }, [hoursQuery.data, availabilityQuery.data]);

  useEffect(() => {
    const err = hoursQuery.error ?? availabilityQuery.error;
    if (err) Alert.alert("Couldn't load availability", err instanceof Error ? err.message : "Please try again.");
  }, [hoursQuery.error, availabilityQuery.error]);

  function toggle(i: number) {
    setSlots((prev) =>
      prev?.map((s, idx) => (idx === i ? { ...s, enabled: !s.enabled } : s)) ?? prev
    );
  }

  function setTime(i: number, key: "startTime" | "endTime", value: string) {
    setSlots((prev) =>
      prev?.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) ?? prev
    );
  }

  async function handleSave() {
    if (!employeeId || !slots) {
      Alert.alert("Error", "No employee profile linked to this account.");
      return;
    }
    const invalid = slots.findIndex((s) => s.enabled && s.startTime >= s.endTime);
    if (invalid !== -1) {
      Alert.alert("Invalid times", `${DAYS[invalid]}: start time must be before end time.`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<number, { startTime: string; endTime: string }> = {};
      slots.forEach((s, i) => {
        if (s.enabled) payload[i] = { startTime: s.startTime, endTime: s.endTime };
      });
      await saveMutation.mutateAsync({ employeeId, schedule: payload });
      Alert.alert("Saved", "Your availability has been updated.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !slots) return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header} />

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {DAYS.map((day, i) => (
          <View key={i} style={styles.row}>
            <TouchableOpacity testID={`avail-day-toggle-${i}`} style={styles.toggle} onPress={() => toggle(i)}>
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
                  theme={theme}
                />
                <Text style={styles.timeSep}>to</Text>
                <TimeSelect
                  value={slots[i].endTime}
                  onChange={(v) => setTime(i, "endTime", v)}
                  theme={theme}
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

function TimeSelect({ value, onChange, theme }: { value: string; onChange: (v: string) => void; theme: ReturnType<typeof useAppTheme> }) {
  const styles = makeStyles(theme);
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

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingBottom: 4 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 8 },
    row: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, gap: 10 },
    toggle: { flexDirection: "row", alignItems: "center", gap: 10 },
    toggleTrack: {
      width: 42, height: 24, borderRadius: 12, backgroundColor: theme.surface2,
      justifyContent: "center", paddingHorizontal: 2,
    },
    toggleTrackOn: { backgroundColor: theme.primary },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.muted },
    toggleThumbOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
    dayLabel: { fontSize: 15, fontWeight: "500", color: theme.secondary },
    dayLabelOn: { color: theme.textSecondary },
    timePickers: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 52 },
    timeSep: { color: theme.secondary, fontSize: 13 },
    timeBtn: { backgroundColor: theme.surface2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    timeBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: "500" },
    picker: { maxHeight: 150, backgroundColor: theme.surface2, borderRadius: 8, marginLeft: 52 },
    pickerItem: { paddingHorizontal: 12, paddingVertical: 8 },
    pickerItemSelected: { backgroundColor: theme.primary + "44" },
    pickerItemText: { color: theme.textSecondary, fontSize: 14 },
    pickerItemTextSelected: { color: "#fff", fontWeight: "600" },
    unavailable: { color: theme.inactive, fontSize: 13, paddingLeft: 52 },
    saveBtn: {
      backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14,
      alignItems: "center", marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
