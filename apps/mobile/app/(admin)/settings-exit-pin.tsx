import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { setExitPin } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";

export default function SettingsExitPinScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const isValid = pin.length >= 4 && pin === confirm && /^\d+$/.test(pin);

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      await setExitPin(pin);
      Alert.alert("Saved", "Kiosk exit PIN updated.");
      setPin("");
      setConfirm("");
    } catch {
      Alert.alert("Error", "Failed to save PIN. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const mismatch = confirm.length > 0 && pin !== confirm;

  return (
    <>
      <Stack.Screen options={{ title: "Kiosk Exit PIN" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This PIN is required to exit kiosk mode on the iPad. Only org admins
            can set it.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.label}>New PIN (4–6 digits)</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg },
              ]}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor={theme.muted}
            />
          </View>
          <View style={[styles.fieldRow, styles.fieldLast]}>
            <Text style={styles.label}>Confirm PIN</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: mismatch ? theme.destructive : theme.surface2,
                  backgroundColor: theme.bg,
                },
              ]}
              value={confirm}
              onChangeText={setConfirm}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor={theme.muted}
            />
          </View>
        </View>

        {mismatch && (
          <Text style={styles.errorText}>PINs do not match.</Text>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!isValid || saving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!isValid || saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Set Exit PIN"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, gap: 16 },
    infoBox: {
      backgroundColor: theme.primarySurface,
      borderRadius: 10,
      padding: 14,
    },
    infoText: { fontSize: 13, color: theme.primary, lineHeight: 18 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    fieldRow: {
      gap: 8,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    fieldLast: { borderBottomWidth: 0 },
    label: { fontSize: 13, color: theme.muted, fontWeight: "500" },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 18,
      letterSpacing: 8,
      textAlign: "center",
    },
    errorText: { fontSize: 13, color: theme.destructive },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
