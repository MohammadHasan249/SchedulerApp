import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, User, Mail, Clock } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { getOrganizationHours, type OrganizationHours } from "@/lib/api";
import { useEffect, useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ProfileScreen() {
  const { session } = useAuthStore();
  const user = session?.user;
  const [orgHours, setOrgHours] = useState<OrganizationHours[]>([]);
  const [loadingHours, setLoadingHours] = useState(true);

  useEffect(() => {
    async function loadHours() {
      try {
        const hours = await getOrganizationHours();
        setOrgHours(hours);
      } catch (err) {
        console.error("Failed to load org hours:", err);
      } finally {
        setLoadingHours(false);
      }
    }
    loadHours();
  }, []);

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.user_metadata?.full_name as string | undefined)?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>

        <Text style={styles.name}>
          {(user?.user_metadata?.full_name as string | undefined) ?? "Employee"}
        </Text>

        {/* Info rows */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Mail size={18} color="#64748b" />
            <Text style={styles.rowText}>{user?.email ?? "—"}</Text>
          </View>
          <View style={[styles.row, styles.rowLast]}>
            <User size={18} color="#64748b" />
            <Text style={styles.rowText}>
              {((user?.app_metadata?.role as string | undefined) ?? "employee")
                .replace("_", " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>
        </View>

        {/* Organization Hours */}
        {loadingHours ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />
        ) : orgHours.length > 0 ? (
          <View style={styles.orgSection}>
            <View style={styles.orgHeader}>
              <Clock size={18} color="#3b82f6" />
              <Text style={styles.orgTitle}>Organization Hours</Text>
            </View>
            {orgHours.map((oh, idx) => (
              <View key={idx} style={[styles.orgRow, idx === orgHours.length - 1 && styles.orgRowLast]}>
                <Text style={styles.orgDay}>{DAYS[oh.dayOfWeek]}</Text>
                <Text style={styles.orgTime}>
                  {oh.isClosed ? "Closed" : `${oh.startTime} - ${oh.endTime}`}
                </Text>
              </View>
            ))}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingHorizontal: 20 },
  header: { paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: "700", color: "#f8fafc" },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#1e40af",
    alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#93c5fd" },
  name: { fontSize: 20, fontWeight: "700", color: "#f1f5f9", textAlign: "center", marginBottom: 24 },
  section: { backgroundColor: "#1e293b", borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#0f172a" },
  rowLast: { borderBottomWidth: 0 },
  rowText: { fontSize: 14, color: "#cbd5e1" },
  orgSection: { backgroundColor: "#1e293b", borderRadius: 12, overflow: "hidden", marginTop: 24 },
  orgHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: "#0f172a" },
  orgTitle: { fontSize: 14, fontWeight: "600", color: "#e2e8f0" },
  orgRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#0f172a" },
  orgRowLast: { borderBottomWidth: 0 },
  orgDay: { fontSize: 13, color: "#cbd5e1", flex: 1 },
  orgTime: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
  spacer: { flex: 1 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#1e293b", borderRadius: 12, paddingVertical: 14, marginBottom: 16, marginTop: 24,
  },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
});
