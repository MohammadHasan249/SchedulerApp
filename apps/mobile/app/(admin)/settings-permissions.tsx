import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react-native";
import {
  getPermissionProfiles,
  createPermissionProfile,
  updatePermissionProfile,
  deletePermissionProfile,
  getEmployees,
  updateEmployee,
} from "@/lib/api";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
  type PermissionProfile,
  type Employee,
} from "@scheduler/types";
import { useAppTheme } from "@/lib/useAppTheme";

export default function SettingsPermissionsScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState<PermissionKey[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [profs, emps] = await Promise.all([getPermissionProfiles(), getEmployees()]);
      setProfiles(profs);
      setEmployees(emps.filter((e) => e.role !== "org_admin" && e.isActive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newName.trim()) {
      setError("Give the profile a name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await createPermissionProfile({ name: newName.trim(), permissions: newPerms });
      setProfiles((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewPerms([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the profile.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleProfilePerm(profile: PermissionProfile, key: PermissionKey) {
    const next = profile.permissions.includes(key)
      ? profile.permissions.filter((k) => k !== key)
      : [...profile.permissions, key];
    setProfiles((ps) => ps.map((p) => (p.id === profile.id ? { ...p, permissions: next } : p)));
    try {
      await updatePermissionProfile(profile.id, { permissions: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update permissions.");
      setProfiles((ps) => ps.map((p) => (p.id === profile.id ? profile : p)));
    }
  }

  function confirmDelete(profile: PermissionProfile) {
    Alert.alert("Delete profile", `Delete "${profile.name}"? Anyone using it loses its access.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const prevProfiles = profiles;
          const prevEmployees = employees;
          setProfiles((ps) => ps.filter((p) => p.id !== profile.id));
          setEmployees((es) =>
            es.map((e) =>
              e.permissionProfileId === profile.id ? { ...e, permissionProfileId: null } : e
            )
          );
          try {
            await deletePermissionProfile(profile.id);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't delete the profile.");
            setProfiles(prevProfiles);
            setEmployees(prevEmployees);
          }
        },
      },
    ]);
  }

  async function assign(employeeId: string, profileId: string | null) {
    const prev = employees;
    setEmployees((es) =>
      es.map((e) => (e.id === employeeId ? { ...e, permissionProfileId: profileId } : e))
    );
    try {
      await updateEmployee(employeeId, { permissionProfileId: profileId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't assign the profile.");
      setEmployees(prev);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Permissions" }} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Permissions" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {error && <Text style={styles.error}>{error}</Text>}

        {/* New profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Name (e.g. Shift Lead)"
            placeholderTextColor={theme.muted}
            value={newName}
            onChangeText={setNewName}
          />
          <View style={styles.chipRow}>
            {PERMISSION_KEYS.map((key) => {
              const on = newPerms.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, on && styles.chipActive]}
                  onPress={() =>
                    setNewPerms((p) => (on ? p.filter((k) => k !== key) : [...p, key]))
                  }
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>
                    {PERMISSION_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, creating && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Profiles */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profiles</Text>
          {profiles.length === 0 && <Text style={styles.empty}>No profiles yet.</Text>}
          {profiles.map((profile) => (
            <View key={profile.id} style={styles.profileBlock}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <TouchableOpacity onPress={() => confirmDelete(profile)} hitSlop={8}>
                  <Trash2 size={16} color={theme.destructive} />
                </TouchableOpacity>
              </View>
              <View style={styles.chipRow}>
                {PERMISSION_KEYS.map((key) => {
                  const on = profile.permissions.includes(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.chip, on && styles.chipActive]}
                      onPress={() => toggleProfilePerm(profile, key)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>
                        {PERMISSION_LABELS[key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Assign */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assign</Text>
          {employees.length === 0 && (
            <Text style={styles.empty}>
              No managers or staff to assign. Org admins already have every permission.
            </Text>
          )}
          {employees.map((emp) => (
            <View key={emp.id} style={styles.assignBlock}>
              <Text style={styles.assignName}>{emp.name}</Text>
              <Text style={styles.assignEmail}>{emp.email}</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !emp.permissionProfileId && styles.chipActive]}
                  onPress={() => assign(emp.id, null)}
                >
                  <Text style={[styles.chipText, !emp.permissionProfileId && styles.chipTextActive]}>
                    None
                  </Text>
                </TouchableOpacity>
                {profiles.map((p) => {
                  const on = emp.permissionProfileId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, on && styles.chipActive]}
                      onPress={() => assign(emp.id, p.id)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 16 },
    centered: { justifyContent: "center", alignItems: "center" },
    error: { color: theme.destructive, fontSize: 13 },
    empty: { color: theme.muted, fontSize: 14 },
    card: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, gap: 12 },
    cardTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.bg,
      backgroundColor: theme.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.bg,
    },
    chipActive: { backgroundColor: theme.primary },
    chipText: { fontSize: 13, color: theme.textSecondary },
    chipTextActive: { color: "#fff", fontWeight: "600" },
    primaryBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    btnDisabled: { opacity: 0.6 },
    profileBlock: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.bg,
      paddingTop: 12,
    },
    profileHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    profileName: { fontSize: 15, fontWeight: "600", color: theme.text },
    assignBlock: { gap: 6, borderTopWidth: 1, borderTopColor: theme.bg, paddingTop: 12 },
    assignName: { fontSize: 14, fontWeight: "600", color: theme.text },
    assignEmail: { fontSize: 12, color: theme.muted },
  });
}
