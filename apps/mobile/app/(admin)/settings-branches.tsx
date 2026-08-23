import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, GitBranch, Check } from "lucide-react-native";
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  type Branch,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useRole, useBranchId } from "@/lib/useRole";
import { US_TIMEZONES } from "@scheduler/types";

type FormState = {
  name: string;
  slug: string;
  address: string;
  timezone: string;
};

const EMPTY_FORM: FormState = { name: "", slug: "", address: "", timezone: "America/New_York" };

export default function SettingsBranchesScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const role = useRole();
  const myBranchId = useBranchId();
  const canCreateOrDelete = role === "org_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [tzPickerVisible, setTzPickerVisible] = useState(false);

  async function load() {
    try {
      const data = await getBranches();
      setBranches(canCreateOrDelete ? data : data.filter((b) => b.id === myBranchId));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalVisible(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({
      name: branch.name,
      slug: branch.slug,
      address: branch.address ?? "",
      timezone: branch.timezone,
    });
    setFormError("");
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        address: form.address.trim() || undefined,
        timezone: form.timezone.trim() || "America/New_York",
      };
      if (editing) {
        const updated = await updateBranch(editing.id, payload);
        setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      } else {
        const created = await createBranch(payload);
        setBranches((prev) => [...prev, created]);
      }
      setModalVisible(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save. Please try again.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(branch: Branch) {
    Alert.alert(
      "Delete Branch",
      `Delete "${branch.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBranch(branch.id);
              setBranches((prev) => prev.filter((b) => b.id !== branch.id));
            } catch {
              Alert.alert("Error", "Failed to delete branch.");
            }
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Branches",
          headerRight: canCreateOrDelete
            ? () => (
                <TouchableOpacity
                  onPress={openCreate}
                  style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
                >
                  <Plus size={22} color={theme.primary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      {loading ? (
        <View style={[styles.container, { justifyContent: "center" }]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {branches.length === 0 ? (
            <View style={styles.empty}>
              <GitBranch size={40} color={theme.muted} />
              <Text style={styles.emptyText}>No branches yet</Text>
              {canCreateOrDelete && (
                <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
                  <Text style={styles.addBtnText}>Add Branch</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              {branches.map((branch, i) => (
                <View
                  key={branch.id}
                  style={[styles.row, i < branches.length - 1 && styles.rowBorder]}
                >
                  <View style={styles.rowInfo}>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    <Text style={styles.branchMeta}>{branch.slug}</Text>
                    {branch.address ? (
                      <Text style={styles.branchMeta}>{branch.address}</Text>
                    ) : null}
                    <Text style={styles.branchMeta}>{branch.timezone}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => openEdit(branch)} style={styles.actionBtn}>
                      <Pencil size={16} color={theme.secondary} />
                    </TouchableOpacity>
                    {canCreateOrDelete && (
                      <TouchableOpacity onPress={() => confirmDelete(branch)} style={styles.actionBtn}>
                        <Trash2 size={16} color={theme.destructive} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? "Edit Branch" : "Add Branch"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg }]}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Downtown"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Slug</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg }]}
                value={form.slug}
                onChangeText={(v) => setForm((f) => ({ ...f, slug: v.toLowerCase().replace(/\s+/g, "-") }))}
                placeholder="e.g. downtown"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.surface2, backgroundColor: theme.bg }]}
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="123 Main St"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Timezone</Text>
              <TouchableOpacity
                style={[styles.input, { borderColor: theme.surface2, backgroundColor: theme.bg, justifyContent: "center" }]}
                onPress={() => setTzPickerVisible(true)}
              >
                <Text style={{ color: theme.text, fontSize: 14 }}>
                  {US_TIMEZONES.find((tz) => tz.value === form.timezone)?.label ?? form.timezone}
                </Text>
              </TouchableOpacity>
            </View>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Branch"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={tzPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Timezone</Text>
              <TouchableOpacity onPress={() => setTzPickerVisible(false)}>
                <X size={20} color={theme.muted} />
              </TouchableOpacity>
            </View>
            {US_TIMEZONES.map((tz) => (
              <TouchableOpacity
                key={tz.value}
                style={styles.tzOption}
                onPress={() => {
                  setForm((f) => ({ ...f, timezone: tz.value }));
                  setTzPickerVisible(false);
                }}
              >
                <Text style={{ color: theme.text, fontSize: 14 }}>{tz.label}</Text>
                {form.timezone === tz.value && <Check size={18} color={theme.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, gap: 20, flexGrow: 1 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 12,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.bg },
    rowInfo: { flex: 1, gap: 2 },
    branchName: { fontSize: 14, fontWeight: "600", color: theme.text },
    branchMeta: { fontSize: 12, color: theme.muted },
    rowActions: { flexDirection: "row", gap: 8 },
    actionBtn: { padding: 6 },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 80,
    },
    emptyText: { fontSize: 15, color: theme.muted },
    addBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 24,
      marginTop: 4,
    },
    addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 16,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
    field: { gap: 6 },
    tzOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    fieldLabel: { fontSize: 12, color: theme.muted, fontWeight: "500" },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    error: { fontSize: 13, color: theme.destructive },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
