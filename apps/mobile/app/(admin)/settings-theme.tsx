import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react-native";
import { getOrganizationTheme, updateOrganizationTheme } from "@/lib/api";
import { useThemeStore } from "@/lib/themeStore";
import { useAppTheme } from "@/lib/useAppTheme";
import { THEME_PRESETS } from "@scheduler/types";

const FIXED_THEME = {
  secondary: "#64748b",
  accent: "#06b6d4",
  background: "#ffffff",
  foreground: "#000000",
} as const;

export default function SettingsThemeScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { setTheme } = useThemeStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrganizationTheme()
      .then((t) => {
        if (t) {
          const match = THEME_PRESETS.find((p) => p.primary === t.primary);
          setSelected(match?.key ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const preset = THEME_PRESETS.find((p) => p.key === selected);
    if (!preset) return;
    setSaving(true);
    try {
      const updated = await updateOrganizationTheme({ primary: preset.primary, ...FIXED_THEME });
      setTheme(updated);
      Alert.alert("Saved", "Theme updated.");
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
        <View style={styles.grid}>
          {THEME_PRESETS.map((preset) => {
            const isSelected = selected === preset.key;
            return (
              <TouchableOpacity
                key={preset.key}
                style={styles.presetItem}
                onPress={() => setSelected(preset.key)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: preset.primary },
                    isSelected && {
                      shadowColor: preset.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.7,
                      shadowRadius: 8,
                      elevation: 6,
                      borderWidth: 3,
                      borderColor: "#ffffff",
                    },
                  ]}
                >
                  {isSelected && (
                    <Check size={20} color="#ffffff" strokeWidth={3} />
                  )}
                </View>
                <Text style={[styles.presetLabel, isSelected && { color: theme.text }]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!selected || saving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!selected || saving}
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
    content: { padding: 24, gap: 32 },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 20,
      justifyContent: "space-between",
    },
    presetItem: {
      alignItems: "center",
      gap: 8,
      width: "30%",
    },
    swatch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    presetLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.muted,
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
