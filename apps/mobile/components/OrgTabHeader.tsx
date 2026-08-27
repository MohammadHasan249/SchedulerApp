import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useOrgStore } from "@/lib/orgStore";
import { useNotificationsStore } from "@/lib/notificationsStore";

export function OrgTabHeader({ title }: { title: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { orgName } = useOrgStore();
  const { unreadCount } = useNotificationsStore();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: theme.bg }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {orgName && (
            <Text style={[styles.orgName, { color: theme.primary }]}>{orgName}</Text>
          )}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Notifications"
          style={styles.bellButton}
          onPress={() => router.push("/(tabs)/notifications")}
        >
          <Bell size={22} color={theme.text} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  orgName: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: "700" },
  bellButton: { padding: 6, marginLeft: 8 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
