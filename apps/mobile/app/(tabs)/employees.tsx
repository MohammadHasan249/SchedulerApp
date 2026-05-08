"use client";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, X, Users } from "lucide-react-native";
import {
  getEmployees,
  inviteEmployee,
  getBranches,
  type Branch,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useRole } from "@/lib/useRole";
import type { Employee } from "@scheduler/types";

type RoleOption = "employee" | "branch_manager" | "org_admin";

const ROLE_LABELS: Record<RoleOption, string> = {
  employee: "Employee",
  branch_manager: "Branch Manager",
  org_admin: "Org Admin",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  role: "employee" as RoleOption,
  branchId: "" as string,
  maxHoursPerWeek: "40",
  pin: "",
};

export default function EmployeesScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const role = useRole();
  const { session } = useAuthStore();
  const userBranchId = session?.user?.app_metadata?.branch_id as string | undefined;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const [emps, brs] = await Promise.all([getEmployees(), getBranches()]);
      setEmployees(emps);
      setBranches(brs);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  function openInvite() {
    setForm({
      ...EMPTY_FORM,
      branchId: role === "branch_manager" ? (userBranchId ?? "") : "",
    });
    setFormError("");
    setModalVisible(true);
  }

  async function handleInvite() {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.email.trim()) { setFormError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormError("Enter a valid email."); return; }
    const maxHours = parseInt(form.maxHoursPerWeek);
    if (isNaN(maxHours) || maxHours < 1 || maxHours > 168) { setFormError("Max hours must be 1–168."); return; }
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) { setFormError("PIN must be 4–6 digits."); return; }

    setSaving(true);
    setFormError("");
    try {
      await inviteEmployee({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        branchId: form.branchId || null,
        maxHoursPerWeek: maxHours,
        ...(form.pin ? { pin: form.pin } : {}),
      });
      setModalVisible(false);
      load();
      Alert.alert("Invited", `An invitation email has been sent to ${form.email.trim()}.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  const branchName = (id: string | null | undefined) =>
    branches.find((b) => b.id === id)?.name ?? "—";

  const availableBranches =
    role === "branch_manager"
      ? branches.filter((b) => b.id === userBranchId)
      : branches;

  const roleOptions: RoleOption[] =
    role === "org_admin"
      ? ["employee", "branch_manager", "org_admin"]
      : ["employee"];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: theme.primary }]} onPress={openInvite}>
          <UserPlus size={16} color="#fff" />
          <Text style={styles.inviteBtnText}>Invite Employee</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : employees.length === 0 ? (
        <View style={styles.empty}>
          <Users size={40} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>No employees yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {employees.map((emp) => (
            <View key={emp.id} style={[styles.card, { backgroundColor: theme.surface, opacity: emp.isActive ? 1 : 0.5 }]}>
              <View style={styles.cardAvatar}>
                <Text style={[styles.cardAvatarText, { color: theme.primary }]}>
                  {emp.name[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardName, { color: theme.text }]}>{emp.name}</Text>
                <Text style={[styles.cardEmail, { color: theme.muted }]}>{emp.email}</Text>
                <View style={styles.cardMeta}>
                  <Text style={[styles.cardTag, { backgroundColor: theme.primary + "22", color: theme.primary }]}>
                    {ROLE_LABELS[emp.role as RoleOption] ?? emp.role}
                  </Text>
                  {emp.branchId && (
                    <Text style={[styles.cardTag, { backgroundColor: theme.surface, color: theme.muted, borderWidth: 1, borderColor: theme.muted + "44" }]}>
                      {branchName(emp.branchId)}
                    </Text>
                  )}
                  {!emp.isActive && (
                    <Text style={[styles.cardTag, { backgroundColor: "#ef444422", color: "#ef4444" }]}>
                      Inactive
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Invite Employee</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]}
                placeholder="Full name"
                placeholderTextColor={theme.muted}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                autoCapitalize="words"
              />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]}
                placeholder="email@example.com"
                placeholderTextColor={theme.muted}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {roleOptions.length > 1 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>Role</Text>
                  <View style={styles.segmented}>
                    {roleOptions.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.segment,
                          { borderColor: theme.primary },
                          form.role === r && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, role: r }))}
                      >
                        <Text style={[styles.segmentText, { color: form.role === r ? "#fff" : theme.primary }]}>
                          {ROLE_LABELS[r]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {availableBranches.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>Branch</Text>
                  <View style={styles.segmented}>
                    {role === "org_admin" && (
                      <TouchableOpacity
                        style={[
                          styles.segment,
                          { borderColor: theme.primary },
                          !form.branchId && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, branchId: "" }))}
                      >
                        <Text style={[styles.segmentText, { color: !form.branchId ? "#fff" : theme.primary }]}>
                          None
                        </Text>
                      </TouchableOpacity>
                    )}
                    {availableBranches.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.segment,
                          { borderColor: theme.primary },
                          form.branchId === b.id && { backgroundColor: theme.primary },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, branchId: b.id }))}
                      >
                        <Text style={[styles.segmentText, { color: form.branchId === b.id ? "#fff" : theme.primary }]}>
                          {b.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max hours / week</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]}
                placeholder="40"
                placeholderTextColor={theme.muted}
                value={form.maxHoursPerWeek}
                onChangeText={(v) => setForm((f) => ({ ...f, maxHoursPerWeek: v }))}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Kiosk PIN (optional, 4–6 digits)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]}
                placeholder="Leave blank to skip"
                placeholderTextColor={theme.muted}
                value={form.pin}
                onChangeText={(v) => setForm((f) => ({ ...f, pin: v }))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />

              {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleInvite}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Send Invitation</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    toolbar: { paddingHorizontal: 20, paddingVertical: 12, alignItems: "flex-end" },
    inviteBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    inviteBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 15 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
    card: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, gap: 12 },
    cardAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.primary + "22", alignItems: "center", justifyContent: "center" },
    cardAvatarText: { fontSize: 18, fontWeight: "700" },
    cardBody: { flex: 1, gap: 2 },
    cardName: { fontSize: 15, fontWeight: "600" },
    cardEmail: { fontSize: 12 },
    cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    cardTag: { fontSize: 11, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
    modalTitle: { fontSize: 20, fontWeight: "700" },
    modalBody: { flex: 1, paddingHorizontal: 20 },
    fieldLabel: { fontSize: 12, fontWeight: "600", marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    segment: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    segmentText: { fontSize: 13, fontWeight: "600" },
    errorText: { color: "#ef4444", fontSize: 13, marginTop: 12 },
    submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24, marginBottom: 40 },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
}
