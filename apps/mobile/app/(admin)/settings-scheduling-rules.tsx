import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ListChecks } from "lucide-react-native";
import { type Branch, type SchedulingRule } from "@/lib/api";
import { useBranchesQuery } from "@/hooks/useBranches";
import {
  useSchedulingRulesQuery, useCreateSchedulingRule, useUpdateSchedulingRule, useDeleteSchedulingRule,
} from "@/hooks/useSchedulingRules";
import { useAppTheme } from "@/lib/useAppTheme";
import { useRole, useBranchId } from "@/lib/useRole";
import { BranchSelector } from "@/components/BranchSelector";

export default function SettingsSchedulingRulesScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const role = useRole();
  const ownBranchId = useBranchId();
  const isBranchManager = role === "branch_manager";

  const branchesQuery = useBranchesQuery();
  const branches: Branch[] = branchesQuery.data ?? [];
  const [branchId, setBranchId] = useState<string | null>(isBranchManager ? ownBranchId : null);

  useEffect(() => {
    if (!isBranchManager && !branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBranchManager, branches.length]);

  const rulesQuery = useSchedulingRulesQuery(branchId);
  const rules = rulesQuery.data ?? [];
  const loading = branchesQuery.isLoading || rulesQuery.isLoading;
  const [ruleText, setRuleText] = useState("");
  const [formError, setFormError] = useState("");
  const createMutation = useCreateSchedulingRule();
  const updateMutation = useUpdateSchedulingRule();
  const deleteMutation = useDeleteSchedulingRule();
  const saving = createMutation.isPending;

  useEffect(() => {
    const err = branchesQuery.error ?? rulesQuery.error;
    if (err) Alert.alert("Couldn't load scheduling rules", err instanceof Error ? err.message : "Please try again.");
  }, [branchesQuery.error, rulesQuery.error]);

  async function handleAdd() {
    if (!branchId || !ruleText.trim()) return;
    setFormError("");
    try {
      await createMutation.mutateAsync({ branchId, ruleText: ruleText.trim() });
      setRuleText("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  async function handleToggle(rule: SchedulingRule) {
    try {
      await updateMutation.mutateAsync({ id: rule.id, updates: { isActive: !rule.isActive } });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update.");
    }
  }

  function handleDelete(rule: SchedulingRule) {
    Alert.alert("Delete rule?", `Remove "${rule.ruleText}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(rule.id);
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete.");
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Scheduling Rules" }} />
      <View style={styles.container}>
        <Text style={styles.intro}>
          Free-text staffing preferences (e.g. &ldquo;always assign 2 Chefs on weekends&rdquo;). The AI scheduling
          assistant applies these as best-effort guidance alongside its hard constraints (hours, availability, time
          off).
        </Text>

        <BranchSelector branches={branches} value={branchId} onChange={setBranchId} />

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={ruleText}
            onChangeText={setRuleText}
            placeholder="e.g. Don't schedule Alex and Jordan on the same shift."
            placeholderTextColor={theme.inactive}
            multiline
          />
          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          <TouchableOpacity
            style={[styles.addBtn, (saving || !ruleText.trim()) && styles.btnDisabled]}
            onPress={handleAdd}
            disabled={saving || !ruleText.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add Rule</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {rules.length === 0 ? (
              <View style={styles.empty}>
                <ListChecks size={40} color={theme.muted} />
                <Text style={styles.emptyText}>No scheduling rules yet</Text>
              </View>
            ) : (
              rules.map((rule) => (
                <View key={rule.id} style={styles.row}>
                  <Text style={[styles.ruleText, !rule.isActive && styles.ruleTextInactive]}>{rule.ruleText}</Text>
                  <View style={styles.rowActions}>
                    <Switch value={rule.isActive} onValueChange={() => handleToggle(rule)} />
                    <TouchableOpacity
                      onPress={() => handleDelete(rule)}
                      style={styles.iconBtn}
                      accessibilityLabel="Delete rule"
                    >
                      <Trash2 size={16} color={theme.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 16, gap: 12 },
    intro: { fontSize: 12, color: theme.muted, lineHeight: 17 },
    addRow: { gap: 8 },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.surface2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
      minHeight: 60,
      textAlignVertical: "top",
    },
    formError: { color: theme.destructive, fontSize: 13 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignSelf: "flex-end",
      paddingHorizontal: 16,
    },
    addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    btnDisabled: { opacity: 0.6 },
    list: { gap: 8, flexGrow: 1, paddingBottom: 24 },
    empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48 },
    emptyText: { color: theme.text, fontSize: 15, fontWeight: "600" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
    },
    ruleText: { fontSize: 14, color: theme.text, flex: 1 },
    ruleTextInactive: { color: theme.muted, textDecorationLine: "line-through" },
    rowActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconBtn: { padding: 6 },
  });
}
