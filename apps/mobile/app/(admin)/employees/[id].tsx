import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Mail, User, Briefcase, GitBranch, Clock, ShieldCheck, Power } from "lucide-react-native";
import {
  getEmployee,
  getBranches,
  getJobRoles,
  updateEmployee,
  deleteEmployee,
  getMyPermissions,
  type Branch,
  type JobRole,
} from "@/lib/api";
import type { Employee } from "@scheduler/types";
import { useAppTheme } from "@/lib/useAppTheme";
import { EmployeeCompensation } from "@/components/EmployeeCompensation";

const ROLE_LABEL: Record<string, string> = {
  org_admin: "Org Admin",
  branch_manager: "Branch Manager",
  employee: "Employee",
};

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [branchMap, setBranchMap] = useState<Record<string, Branch>>({});
  const [jobRoleMap, setJobRoleMap] = useState<Record<string, JobRole>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [canViewSalary, setCanViewSalary] = useState(false);
  const [canEditSalary, setCanEditSalary] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const [emp, branches, jobRoles, permissions] = await Promise.all([
        getEmployee(id),
        getBranches(),
        getJobRoles(),
        getMyPermissions(),
      ]);
      setEmployee(emp);
      setBranchMap(Object.fromEntries(branches.map((b) => [b.id, b])));
      setJobRoleMap(Object.fromEntries(jobRoles.map((j) => [j.id, j])));
      setCanViewSalary(permissions.includes("salaries:view"));
      setCanEditSalary(permissions.includes("salaries:edit"));
    } catch (e) {
      Alert.alert("Couldn't load employee", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleToggleActive() {
    if (!employee) return;
    const nextActive = !employee.isActive;
    setActing(true);
    try {
      if (nextActive) {
        const updated = await updateEmployee(employee.id, { isActive: true });
        setEmployee({ ...employee, ...updated });
      } else {
        await deleteEmployee(employee.id);
        setEmployee({ ...employee, isActive: false });
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Couldn't update employee.");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Employee" }} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </>
    );
  }

  if (!employee) {
    return (
      <>
        <Stack.Screen options={{ title: "Employee" }} />
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.emptyText}>Employee not found.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: employee.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{employee.name[0]?.toUpperCase() ?? "?"}</Text>
          </View>
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.email}>{employee.email}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: (employee.isActive ? "#22c55e" : theme.muted) + "33" },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: employee.isActive ? "#22c55e" : theme.muted },
              ]}
            >
              {employee.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>

          <DetailRow
            icon={<ShieldCheck size={16} color={theme.primary} />}
            label="Role"
            value={ROLE_LABEL[employee.role] ?? employee.role}
            theme={theme}
          />
          <DetailRow
            icon={<GitBranch size={16} color={theme.primary} />}
            label="Branch"
            value={employee.branchId ? branchMap[employee.branchId]?.name ?? "—" : "—"}
            theme={theme}
          />
          <DetailRow
            icon={<Briefcase size={16} color={theme.primary} />}
            label="Job Role"
            value={employee.jobRoleId ? jobRoleMap[employee.jobRoleId]?.name ?? "—" : "—"}
            theme={theme}
          />
          <DetailRow
            icon={<Clock size={16} color={theme.primary} />}
            label="Max hours/week"
            value={String(employee.maxHoursPerWeek ?? 40)}
            theme={theme}
            last
          />
        </View>

        {canViewSalary && (
          <EmployeeCompensation employeeId={employee.id} canEdit={canEditSalary} />
        )}

        <TouchableOpacity
          style={[
            styles.actionBtn,
            employee.isActive ? styles.deactivateBtn : styles.activateBtn,
            acting && styles.btnDisabled,
          ]}
          onPress={handleToggleActive}
          disabled={acting}
        >
          {acting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Power size={16} color="#fff" />
              <Text style={styles.actionBtnText}>
                {employee.isActive ? "Deactivate" : "Reactivate"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back to employees</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
  theme,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  theme: ReturnType<typeof useAppTheme>;
  last?: boolean;
}) {
  return (
    <View style={[detailRowStyles(theme).row, !last && detailRowStyles(theme).withBorder]}>
      <View style={detailRowStyles(theme).labelGroup}>
        {icon}
        <Text style={detailRowStyles(theme).label}>{label}</Text>
      </View>
      <Text style={detailRowStyles(theme).value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function detailRowStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      gap: 12,
    },
    withBorder: { borderBottomWidth: 1, borderBottomColor: theme.bg },
    labelGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
    label: { color: theme.muted, fontSize: 13 },
    value: { color: theme.text, fontSize: 14, fontWeight: "500", flex: 1, textAlign: "right" },
  });
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 16 },
    centered: { justifyContent: "center", alignItems: "center" },
    emptyText: { color: theme.muted, fontSize: 14 },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 20,
      alignItems: "center",
      gap: 8,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary + "44",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    avatarText: { fontSize: 24, fontWeight: "700", color: theme.primary },
    name: { fontSize: 18, fontWeight: "700", color: theme.text },
    email: { fontSize: 13, color: theme.muted },
    statusBadge: {
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginTop: 4,
    },
    statusText: { fontSize: 12, fontWeight: "600" },
    card: { backgroundColor: theme.surface, borderRadius: 14, padding: 16 },
    cardTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 12,
      paddingVertical: 14,
    },
    activateBtn: { backgroundColor: "#22c55e" },
    deactivateBtn: { backgroundColor: theme.destructive },
    actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    btnDisabled: { opacity: 0.6 },
    backLink: { alignSelf: "center", padding: 8 },
    backLinkText: { color: theme.primary, fontSize: 14, fontWeight: "500" },
  });
}
