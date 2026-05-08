import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { getOrganizationTheme, updateOrganizationTheme } from "@/lib/api";
import { useThemeStore } from "@/lib/themeStore";
import { useAppTheme } from "@/lib/useAppTheme";
import type { OrganizationTheme } from "@scheduler/types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const COLOR_FIELDS: Array<{ key: keyof OrganizationTheme; label: string }> = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
];

const DEFAULTS: OrganizationTheme = {
  primary: "#3b82f6",
  secondary: "#64748b",
  accent: "#06b6d4",
  background: "#ffffff",
  foreground: "#000000",
};

export default function SettingsThemeScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { setTheme } = useThemeStore();
  const [colors, setColors] = useState<OrganizationTheme>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrganizationTheme()
      .then((t) => { if (t) setColors(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateColor(key: keyof OrganizationTheme, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  function isValid() {
    return COLOR_FIELDS.every(({ key }) => HEX_RE.test(colors[key]));
  }

  async function handleSave() {
    if (!isValid()) {
      Alert.alert("Invalid colors", "All colors must be valid hex codes (e.g. #3b82f6).");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateOrganizationTheme(colors);
      setTheme(updated);
      Alert.alert("Saved", "Theme colors updated.");
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
      <Stack.Screen options={{ title: "Theme Colors" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {COLOR_FIELDS.map(({ key, label }, i) => {
            const valid = HEX_RE.test(colors[key]);
            return (
              <View
                key={key}
                style={[styles.fieldRow, i < COLOR_FIELDS.length - 1 && styles.fieldBorder]}
              >
                <View style={styles.fieldLeft}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: valid ? colors[key] : theme.surface2 },
                    ]}
                  />
                  <Text style={styles.fieldLabel}>{label}</Text>
                </View>
                <TextInput
                  style={[
                    styles.hexInput,
                    {
                      color: theme.text,
                      borderColor: valid ? theme.surface2 : theme.destructive,
                      backgroundColor: theme.bg,
                    },
                  ]}
                  value={colors[key]}
                  onChangeText={(v) => updateColor(key, v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="#000000"
                  placeholderTextColor={theme.muted}
                  maxLength={7}
                />
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (saving || !isValid()) && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving || !isValid()}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save Theme"}
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
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    fieldBorder: { borderBottomWidth: 1, borderBottomColor: theme.bg },
    fieldLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    swatch: { width: 28, height: 28, borderRadius: 6 },
    fieldLabel: { fontSize: 14, color: theme.textSecondary },
    hexInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      width: 100,
      textAlign: "center",
      fontFamily: "monospace",
    },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
