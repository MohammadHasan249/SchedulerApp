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
import { UserPlus, Pencil, X, Users } from "lucide-react-native";
import {
  getEmployees,
  inviteEmployee,
  updateEmployee,
  getBranches,
  getJobRoles,
  type Branch,
  type JobRole,
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

const EMPTY_INVITE = {
  name: "",
  email: "",
  role: "employee" as RoleOption,
  branchId: "",
  maxHoursPerWeek: "40",
  pin: "",
};

type EditForm = {
  branchId: string;
  jobRoleId: string;
  maxHoursPerWeek: string;
};

// Pill selector shared between invite and edit modals
function PillSelect<T extends string>({
  options,
  labels,
  value,
  onChange,
  theme,
  styles,
}: {
  options: T[];
  labels: Record<string, string>;
  value: T | "";
  onChange: (v: T | "") => void;
  theme: ReturnType<typeof useAppTheme>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.segment, { borderColor: theme.primary }, active && { backgroundColor: theme.primary }]}
            onPress={() => onChange(active ? ("" as T | "") : opt)}
          >
            <Text style={[styles.segmentText, { color: active ? "#fff" : theme.primary }]}>
              {labels[opt] ?? opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function EmployeesScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const role = useRole();
  const { session } = useAuthStore();
  const userBranchId = session?.user?.app_metadata?.branch_id as string | undefined;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Edit modal
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ branchId: "", jobRoleId: "", maxHoursPerWeek: "40" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    try {
      const [emps, brs, jrs] = await Promise.all([getEmployees(), getBranches(), getJobRoles()]);
      setEmployees(emps);
      setBranches(brs);
      setJobRoles(jrs);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // ── Invite ────────────────────────────────────────────────────
  function openInvite() {
    setInviteForm({ ...EMPTY_INVITE, branchId: role === "branch_manager" ? (userBranchId ?? "") : "" });
    setInviteError("");
    setInviteVisible(true);
  }

  async function handleInvite() {
    if (!inviteForm.name.trim()) { setInviteError("Name is required."); return; }
    if (!inviteForm.email.trim()) { setInviteError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) { setInviteError("Enter a valid email."); return; }
    const maxHours = parseInt(inviteForm.maxHoursPerWeek);
    if (isNaN(maxHours) || maxHours < 1 || maxHours > 168) { setInviteError("Max hours must be 1–168."); return; }
    if (inviteForm.pin && !/^\d{4,6}$/.test(inviteForm.pin)) { setInviteError("PIN must be 4–6 digits."); return; }

    setInviteSaving(true);
    setInviteError("");
    try {
      await inviteEmployee({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
        branchId: inviteForm.branchId || null,
        maxHoursPerWeek: maxHours,
        ...(inviteForm.pin ? { pin: inviteForm.pin } : {}),
      });
      setInviteVisible(false);
      load();
      Alert.alert("Invited", `An invitation email has been sent to ${inviteForm.email.trim()}.`);
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setInviteSaving(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────
  function openEdit(emp: Employee) {
    setEditTarget(emp);
    setEditForm({
      branchId: emp.branchId ?? "",
      jobRoleId: emp.jobRoleId ?? "",
      maxHoursPerWeek: String(emp.maxHoursPerWeek),
    });
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    const maxHours = parseInt(editForm.maxHoursPerWeek);
    if (isNaN(maxHours) || maxHours < 1 || maxHours > 168) { setEditError("Max hours must be 1–168."); return; }

    setEditSaving(true);
    setEditError("");
    try {
      await updateEmployee(editTarget.id, {
        branchId: editForm.branchId || null,
        jobRoleId: editForm.jobRoleId || null,
        maxHoursPerWeek: maxHours,
      });
      setEditTarget(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(emp: Employee) {
    const action = emp.isActive ? "Deactivate" : "Activate";
    Alert.alert(
      `${action} ${emp.name}?`,
      emp.isActive ? "They will no longer be able to log in." : "They will regain access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: emp.isActive ? "destructive" : "default",
          onPress: async () => {
            try {
              await updateEmployee(emp.id, { isActive: !emp.isActive });
              load();
            } catch {}
          },
        },
      ]
    );
  }

  // ── Helpers ───────────────────────────────────────────────────
  const branchName = (id: string | null | undefined) => branches.find((b) => b.id === id)?.name ?? "—";
  const jobRoleName = (id: string | null | undefined) => jobRoles.find((r) => r.id === id)?.name ?? null;

  const availableBranches = role === "branch_manager"
    ? branches.filter((b) => b.id === userBranchId)
    : branches;

  const inviteRoleOptions: RoleOption[] = role === "org_admin"
    ? ["employee", "branch_manager", "org_admin"]
    : ["employee"];

  const branchLabels = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const jobRoleLabels = Object.fromEntries(jobRoles.map((r) => [r.id, r.name]));

  // ── Render ────────────────────────────────────────────────────
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
                  {emp.jobRoleId && (
                    <Text style={[styles.cardTag, { backgroundColor: theme.surface, color: theme.muted, borderWidth: 1, borderColor: theme.muted + "44" }]}>
                      {jobRoleName(emp.jobRoleId)}
                    </Text>
                  )}
                  {!emp.isActive && (
                    <Text style={[styles.cardTag, { backgroundColor: "#ef444422", color: "#ef4444" }]}>
                      Inactive
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(emp)}>
                <Pencil size={16} color={theme.muted} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Invite Modal ── */}
      <Modal visible={inviteVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInviteVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Invite Employee</Text>
              <TouchableOpacity onPress={() => setInviteVisible(false)}>
                <X size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Name *</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]} placeholder="Full name" placeholderTextColor={theme.muted} value={inviteForm.name} onChangeText={(v) => setInviteForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Email *</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]} placeholder="email@example.com" placeholderTextColor={theme.muted} value={inviteForm.email} onChangeText={(v) => setInviteForm((f) => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              {inviteRoleOptions.length > 1 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>Role</Text>
                  <View style={styles.segmented}>
                    {inviteRoleOptions.map((r) => (
                      <TouchableOpacity key={r} style={[styles.segment, { borderColor: theme.primary }, inviteForm.role === r && { backgroundColor: theme.primary }]} onPress={() => setInviteForm((f) => ({ ...f, role: r }))}>
                        <Text style={[styles.segmentText, { color: inviteForm.role === r ? "#fff" : theme.primary }]}>{ROLE_LABELS[r]}</Text>
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
                      <TouchableOpacity style={[styles.segment, { borderColor: theme.primary }, !inviteForm.branchId && { backgroundColor: theme.primary }]} onPress={() => setInviteForm((f) => ({ ...f, branchId: "" }))}>
                        <Text style={[styles.segmentText, { color: !inviteForm.branchId ? "#fff" : theme.primary }]}>None</Text>
                      </TouchableOpacity>
                    )}
                    {availableBranches.map((b) => (
                      <TouchableOpacity key={b.id} style={[styles.segment, { borderColor: theme.primary }, inviteForm.branchId === b.id && { backgroundColor: theme.primary }]} onPress={() => setInviteForm((f) => ({ ...f, branchId: b.id }))}>
                        <Text style={[styles.segmentText, { color: inviteForm.branchId === b.id ? "#fff" : theme.primary }]}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max hours / week</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]} placeholder="40" placeholderTextColor={theme.muted} value={inviteForm.maxHoursPerWeek} onChangeText={(v) => setInviteForm((f) => ({ ...f, maxHoursPerWeek: v }))} keyboardType="numeric" />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Kiosk PIN (optional, 4–6 digits)</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]} placeholder="Leave blank to skip" placeholderTextColor={theme.muted} value={inviteForm.pin} onChangeText={(v) => setInviteForm((f) => ({ ...f, pin: v }))} keyboardType="numeric" secureTextEntry maxLength={6} />

              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: inviteSaving ? 0.6 : 1 }]} onPress={handleInvite} disabled={inviteSaving}>
                {inviteSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Send Invitation</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={!!editTarget} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
                {editTarget?.name ?? "Edit Employee"}
              </Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}>
                <X size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">

              {availableBranches.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>Branch</Text>
                  <PillSelect
                    options={availableBranches.map((b) => b.id)}
                    labels={branchLabels}
                    value={editForm.branchId as string}
                    onChange={(v) => setEditForm((f) => ({ ...f, branchId: v }))}
                    theme={theme}
                    styles={styles}
                  />
                </>
              )}

              {jobRoles.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>Job Role</Text>
                  <PillSelect
                    options={jobRoles.map((r) => r.id)}
                    labels={jobRoleLabels}
                    value={editForm.jobRoleId as string}
                    onChange={(v) => setEditForm((f) => ({ ...f, jobRoleId: v }))}
                    theme={theme}
                    styles={styles}
                  />
                </>
              )}

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max hours / week</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.muted + "33" }]}
                placeholder="40"
                placeholderTextColor={theme.muted}
                value={editForm.maxHoursPerWeek}
                onChangeText={(v) => setEditForm((f) => ({ ...f, maxHoursPerWeek: v }))}
                keyboardType="numeric"
              />

              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: editSaving ? 0.6 : 1 }]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
              </TouchableOpacity>

              {editTarget && (
                <TouchableOpacity
                  style={[styles.dangerBtn, { borderColor: editTarget.isActive ? "#ef4444" : theme.primary }]}
                  onPress={() => { setEditTarget(null); handleToggleActive(editTarget); }}
                >
                  <Text style={[styles.dangerBtnText, { color: editTarget.isActive ? "#ef4444" : theme.primary }]}>
                    {editTarget.isActive ? "Deactivate Employee" : "Activate Employee"}
                  </Text>
                </TouchableOpacity>
              )}
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
    editBtn: { padding: 8 },
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
    modalTitle: { fontSize: 20, fontWeight: "700", flex: 1, marginRight: 12 },
    modalBody: { flex: 1, paddingHorizontal: 20 },
    fieldLabel: { fontSize: 12, fontWeight: "600", marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    segmented: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    segment: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    segmentText: { fontSize: 13, fontWeight: "600" },
    errorText: { color: "#ef4444", fontSize: 13, marginTop: 12 },
    submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 24, marginBottom: 12 },
    submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    dangerBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 40, borderWidth: 1 },
    dangerBtnText: { fontSize: 15, fontWeight: "600" },
  });
}
