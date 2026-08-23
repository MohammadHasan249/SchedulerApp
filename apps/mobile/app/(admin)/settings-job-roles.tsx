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
import { Plus, Pencil, Trash2, X, Briefcase } from "lucide-react-native";
import {
  getJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
  type JobRole,
} from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";

export default function SettingsJobRolesScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<JobRole | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    try {
      setRoles(await getJobRoles());
    } catch (e) {
      Alert.alert("Couldn't load job roles", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setFormError("");
    setModalVisible(true);
  }

  function openEdit(role: JobRole) {
    setEditing(role);
    setName(role.name);
    setFormError("");
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateJobRole(editing.id, name.trim());
      } else {
        await createJobRole(name.trim());
      }
      setModalVisible(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(role: JobRole) {
    Alert.alert(
      "Delete job role?",
      `Remove "${role.name}"? Employees and shifts referencing it will be unset.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteJobRole(role.id);
              await load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete.");
            }
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Job Roles" }} />
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {roles.length === 0 ? (
              <View style={styles.empty}>
                <Briefcase size={40} color={theme.muted} />
                <Text style={styles.emptyText}>No job roles yet</Text>
                <Text style={styles.emptySub}>
                  Add roles like Cook, Server, Cashier so you can assign role requirements to shifts.
                </Text>
              </View>
            ) : (
              roles.map((role) => (
                <View key={role.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Briefcase size={18} color={theme.primary} />
                    <Text style={styles.rowName}>{role.name}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      onPress={() => openEdit(role)}
                      style={styles.iconBtn}
                      accessibilityLabel={`Edit ${role.name}`}
                    >
                      <Pencil size={16} color={theme.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(role)}
                      style={styles.iconBtn}
                      accessibilityLabel={`Delete ${role.name}`}
                    >
                      <Trash2 size={16} color={theme.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={openCreate}
          activeOpacity={0.8}
          accessibilityLabel="Add job role"
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Edit Job Role" : "New Job Role"}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.iconBtn}>
                <X size={20} color={theme.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cook, Server, Cashier"
              placeholderTextColor={theme.inactive}
              autoFocus
            />

            {!!formError && <Text style={styles.formError}>{formError}</Text>}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{editing ? "Save" : "Create"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    list: { padding: 16, gap: 8, flexGrow: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 64 },
    emptyText: { color: theme.text, fontSize: 16, fontWeight: "600" },
    emptySub: { color: theme.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
    },
    rowMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    rowName: { fontSize: 15, fontWeight: "500", color: theme.text },
    rowActions: { flexDirection: "row", gap: 4 },
    iconBtn: { padding: 8 },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 20,
    },
    modalBox: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, gap: 12 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    modalTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
    label: { fontSize: 12, fontWeight: "600", color: theme.muted },
    input: {
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.surface2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    formError: { color: theme.destructive, fontSize: 13 },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    btnDisabled: { opacity: 0.6 },
  });
}
