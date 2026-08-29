import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LogOut,
  User,
  Mail,
  Clock,
  ChevronRight,
  ChevronDown,
  Palette,
  KeyRound,
  GitBranch,
  Briefcase,
  BarChart2,
  ShieldCheck,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { getOrganizationHours, unregisterPushToken, type HoursSchedule } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import * as Notifications from "expo-notifications";
import { useIsAdmin, useRole } from "@/lib/useRole";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function ProfileScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const { session, employeeName, setEmployeeName } = useAuthStore();
  const { fetchMyEmployee } = useMyEmployeeStore();
  const isAdmin = useIsAdmin();
  const role = useRole();
  const user = session?.user;
  const [orgHours, setOrgHours] = useState<HoursSchedule | null>(null);
  const [loadingHours, setLoadingHours] = useState(true);
  const [hoursExpanded, setHoursExpanded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const hours = await getOrganizationHours();
        setOrgHours(hours);
      } catch {
      } finally {
        setLoadingHours(false);
      }

      if (!employeeName && session?.user?.id) {
        const fullName = session.user.user_metadata?.full_name as string | undefined;
        if (fullName) {
          setEmployeeName(fullName);
        } else {
          const me = await fetchMyEmployee(session.user.id);
          if (me?.name) setEmployeeName(me.name);
        }
      }
    }
    if (session) {
      loadData();
    } else {
      setLoadingHours(false);
    }
  }, [session]);

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            const { data } = await Notifications.getExpoPushTokenAsync();
            if (data) await unregisterPushToken(data);
          } catch {
            // best-effort — a stale token just goes unused, not sent to
          }
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {employeeName?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>

        <Text style={styles.name}>
          {employeeName ?? "—"}
        </Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Mail size={18} color={theme.secondary} />
            <Text style={styles.rowText}>{user?.email ?? "—"}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <User size={18} color={theme.secondary} />
            <Text style={styles.rowText}>
              {(
                (user?.app_metadata?.role as string | undefined) ?? "employee"
              )
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>
        </View>

        {/* Non-admin: read-only org hours block. Admins skip this since their
            Settings section already has an Organization Hours editor entry. */}
        {!isAdmin && loadingHours ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : !isAdmin && orgHours && Object.keys(orgHours).length > 0 ? (
          <View style={styles.orgSection}>
            <TouchableOpacity
              style={[styles.orgHeader, !hoursExpanded && { borderBottomWidth: 0 }]}
              onPress={() => setHoursExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Clock size={18} color={theme.primary} />
              <Text style={[styles.orgTitle, { flex: 1 }]}>Organization Hours</Text>
              {hoursExpanded ? (
                <ChevronDown size={16} color={theme.muted} />
              ) : (
                <ChevronRight size={16} color={theme.muted} />
              )}
            </TouchableOpacity>
            {hoursExpanded &&
              DAYS.map((day, i) => {
                const slot = orgHours[i.toString()];
                return (
                  <View
                    key={i}
                    style={[
                      styles.orgRow,
                      i === DAYS.length - 1 && styles.orgRowLast,
                    ]}
                  >
                    <Text style={styles.orgDay}>{day}</Text>
                    <Text style={styles.orgTime}>
                      {slot ? `${slot.startTime} – ${slot.endTime}` : "Closed"}
                    </Text>
                  </View>
                );
              })}
          </View>
        ) : null}

        {/* Admin-only settings section */}
        {isAdmin && (
          <View style={[styles.orgSection]}>
            <View style={styles.orgHeader}>
              <Text style={styles.orgTitle}>Manage</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => router.push("/(admin)/reports")}
            >
              <BarChart2 size={18} color={theme.secondary} />
              <Text style={styles.settingsRowText}>Attendance Reports</Text>
              <ChevronRight size={16} color={theme.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => router.push("/(admin)/settings-hours")}
            >
              <Clock size={18} color={theme.secondary} />
              <Text style={styles.settingsRowText}>Organization Hours</Text>
              <ChevronRight size={16} color={theme.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => router.push("/(admin)/settings-branches")}
            >
              <GitBranch size={18} color={theme.secondary} />
              <Text style={styles.settingsRowText}>Branches</Text>
              <ChevronRight size={16} color={theme.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => router.push("/(admin)/settings-job-roles")}
            >
              <Briefcase size={18} color={theme.secondary} />
              <Text style={styles.settingsRowText}>Job Roles</Text>
              <ChevronRight size={16} color={theme.muted} />
            </TouchableOpacity>
            {role === "org_admin" && (
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => router.push("/(admin)/settings-permissions")}
              >
                <ShieldCheck size={18} color={theme.secondary} />
                <Text style={styles.settingsRowText}>Permissions</Text>
                <ChevronRight size={16} color={theme.muted} />
              </TouchableOpacity>
            )}
            {!BRAND.lockedThemeKey && (
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => router.push("/(admin)/settings-theme")}
              >
                <Palette size={18} color={theme.secondary} />
                <Text style={styles.settingsRowText}>Theme Colors</Text>
                <ChevronRight size={16} color={theme.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.settingsRow, styles.rowLast]}
              onPress={() => router.push("/(admin)/settings-exit-pin")}
            >
              <KeyRound size={18} color={theme.secondary} />
              <Text style={styles.settingsRowText}>Kiosk Exit PIN</Text>
              <ChevronRight size={16} color={theme.muted} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={18} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + "44",
      alignSelf: "center",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 16,
      marginBottom: 12,
    },
    avatarText: { fontSize: 32, fontWeight: "700", color: theme.primary },
    name: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
      marginBottom: 24,
    },
    section: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    rowLast: { borderBottomWidth: 0 },
    rowText: { fontSize: 14, color: theme.textSecondary },
    orgSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
      marginTop: 24,
    },
    orgHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    orgTitle: { fontSize: 14, fontWeight: "600", color: theme.text },
    orgRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    orgRowLast: { borderBottomWidth: 0 },
    orgDay: { fontSize: 13, color: theme.textSecondary, flex: 1 },
    orgTime: { fontSize: 13, color: theme.muted, fontWeight: "500" },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.bg,
    },
    settingsRowText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.surface,
      borderRadius: 12,
      paddingVertical: 14,
      marginBottom: 16,
      marginTop: 24,
    },
    signOutText: { color: theme.destructive, fontSize: 15, fontWeight: "600" },
  });
}
