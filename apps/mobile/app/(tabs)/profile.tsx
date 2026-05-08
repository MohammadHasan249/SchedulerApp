import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, User, Mail, Clock } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { getOrganizationHours, type HoursSchedule } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useEffect, useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ProfileScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { session } = useAuthStore();
  const user = session?.user;
  const [orgHours, setOrgHours] = useState<HoursSchedule | null>(null);
  const [loadingHours, setLoadingHours] = useState(true);

  useEffect(() => {
    async function loadHours() {
      try {
        const hours = await getOrganizationHours();
        setOrgHours(hours);
      } catch (err) {
      } finally {
        setLoadingHours(false);
      }
    }
    if (session) {
      loadHours();
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
        onPress: async () => { await supabase.auth.signOut(); },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.user_metadata?.full_name as string | undefined)?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>

        <Text style={styles.name}>
          {(user?.user_metadata?.full_name as string | undefined) ?? "Employee"}
        </Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Mail size={18} color={theme.secondary} />
            <Text style={styles.rowText}>{user?.email ?? "—"}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <User size={18} color={theme.secondary} />
            <Text style={styles.rowText}>
              {((user?.app_metadata?.role as string | undefined) ?? "employee")
                .replace("_", " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>
        </View>

        {loadingHours ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : orgHours && Object.keys(orgHours).length > 0 ? (
          <View style={styles.orgSection}>
            <View style={styles.orgHeader}>
              <Clock size={18} color={theme.primary} />
              <Text style={styles.orgTitle}>Organization Hours</Text>
            </View>
            {DAYS.map((day, i) => {
              const slot = orgHours[i.toString()];
              return (
                <View key={i} style={[styles.orgRow, i === DAYS.length - 1 && styles.orgRowLast]}>
                  <Text style={styles.orgDay}>{day}</Text>
                  <Text style={styles.orgTime}>
                    {slot ? `${slot.startTime} – ${slot.endTime}` : "Closed"}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.spacer} />

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
      width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + "44",
      alignSelf: "center", justifyContent: "center", alignItems: "center", marginTop: 16, marginBottom: 12,
    },
    avatarText: { fontSize: 32, fontWeight: "700", color: theme.primary },
    name: { fontSize: 20, fontWeight: "700", color: theme.text, textAlign: "center", marginBottom: 24 },
    section: { backgroundColor: theme.surface, borderRadius: 12, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.bg },
    rowLast: { borderBottomWidth: 0 },
    rowText: { fontSize: 14, color: theme.textSecondary },
    orgSection: { backgroundColor: theme.surface, borderRadius: 12, overflow: "hidden", marginTop: 24 },
    orgHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.bg },
    orgTitle: { fontSize: 14, fontWeight: "600", color: theme.text },
    orgRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: theme.bg },
    orgRowLast: { borderBottomWidth: 0 },
    orgDay: { fontSize: 13, color: theme.textSecondary, flex: 1 },
    orgTime: { fontSize: 13, color: theme.muted, fontWeight: "500" },
    spacer: { flex: 1 },
    signOutBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: theme.surface, borderRadius: 12, paddingVertical: 14, marginBottom: 16, marginTop: 24,
    },
    signOutText: { color: theme.destructive, fontSize: 15, fontWeight: "600" },
  });
}
