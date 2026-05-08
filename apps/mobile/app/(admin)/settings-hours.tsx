import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  getOrganizationHours,
  updateOrganizationHours,
  type HoursSchedule,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type DayState = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

function toSchedule(days: DayState[]): HoursSchedule {
  const schedule: HoursSchedule = {};
  days.forEach((d, i) => {
    if (d.enabled) {
      schedule[i.toString()] = {
        startTime: d.startTime,
        endTime: d.endTime,
      };
    }
  });
  return schedule;
}

function fromSchedule(schedule: HoursSchedule): DayState[] {
  return DAYS.map((_, i) => {
    const slot = schedule[i.toString()];
    return {
      enabled: !!slot,
      startTime: slot?.startTime ?? "09:00",
      endTime: slot?.endTime ?? "17:00",
    };
  });
}

export default function SettingsHoursScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [days, setDays] = useState<DayState[]>(
    DAYS.map(() => ({ enabled: true, startTime: "09:00", endTime: "17:00" }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrganizationHours()
      .then((s) => setDays(fromSchedule(s)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateDay(i: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateOrganizationHours(toSchedule(days));
      Alert.alert("Saved", "Organization hours updated.");
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Organization Hours" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {DAYS.map((day, i) => (
            <View
              key={i}
              style={[styles.dayRow, i < DAYS.length - 1 && styles.dayRowBorder]}
            >
              <View style={styles.dayTop}>
                <Text style={styles.dayName}>{day}</Text>
                <Switch
                  value={days[i].enabled}
                  onValueChange={(v) => updateDay(i, { enabled: v })}
                  trackColor={{ true: theme.primary, false: theme.surface2 }}
                  thumbColor={days[i].enabled ? "#fff" : theme.muted}
                />
              </View>
              {days[i].enabled && (
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Open</Text>
                    <TextInput
                      style={[styles.timeInput, { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg }]}
                      value={days[i].startTime}
                      onChangeText={(v) => updateDay(i, { startTime: v })}
                      placeholder="09:00"
                      placeholderTextColor={theme.muted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <Text style={styles.timeSep}>–</Text>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Close</Text>
                    <TextInput
                      style={[styles.timeInput, { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg }]}
                      value={days[i].endTime}
                      onChangeText={(v) => updateDay(i, { endTime: v })}
                      placeholder="17:00"
                      placeholderTextColor={theme.muted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save Hours"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, gap: 20 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    dayRow: { padding: 14, gap: 12 },
    dayRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.bg },
    dayTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dayName: { fontSize: 14, fontWeight: "600", color: theme.text },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    timeField: { flex: 1, gap: 4 },
    timeLabel: { fontSize: 11, color: theme.muted, fontWeight: "500" },
    timeInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      textAlign: "center",
    },
    timeSep: { fontSize: 16, color: theme.muted, marginTop: 16 },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
