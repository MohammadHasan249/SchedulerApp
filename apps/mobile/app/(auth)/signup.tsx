import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, Link } from "expo-router";
import { Building2, User } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function SignupChoiceScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Scheduler</Text>
          <Text style={styles.subtitle}>Choose how you'd like to get started</Text>
        </View>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => router.push("/(auth)/signup-org")}
        >
          <View style={[styles.iconBubble, { backgroundColor: theme.primary + "22" }]}>
            <Building2 size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Create Organization</Text>
            <Text style={styles.cardSub}>Set up your company and become an admin</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => router.push("/(auth)/signup-employee")}
        >
          <View style={[styles.iconBubble, { backgroundColor: "#8b5cf622" }]}>
            <User size={20} color="#8b5cf6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Join as Employee</Text>
            <Text style={styles.cardSub}>You were invited to join an organization</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.footerLink}>
            Sign in
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    inner: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
    header: { alignItems: "center", marginBottom: 12, gap: 6 },
    title: { fontSize: 26, fontWeight: "700", color: theme.text },
    subtitle: { fontSize: 14, color: theme.muted },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: theme.text },
    cardSub: { fontSize: 13, color: theme.muted, marginTop: 2 },
    footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
    footerText: { color: theme.muted, fontSize: 14 },
    footerLink: { color: theme.primary, fontSize: 14, fontWeight: "600" },
  });
}
