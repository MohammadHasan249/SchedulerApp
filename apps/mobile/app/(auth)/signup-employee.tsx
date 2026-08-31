import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { useRouter, Stack } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { BRAND } from "@/lib/brand";

export default function SignupEmployeeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/employee-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Signup failed", typeof data.error === "string" ? data.error : "Something went wrong");
        return;
      }
      Alert.alert(
        "Check your email",
        "Confirm your email, then sign in to continue.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (e) {
      Alert.alert("Signup failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Join as Employee" }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: BRAND.authBackground }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Join as Employee</Text>
          <Text style={styles.subtitle}>
            Use the email your manager invited. You'll be linked to your organization automatically.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="signup-employee-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={BRAND.authMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="signup-employee-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={BRAND.authMuted}
              secureTextEntry
              autoComplete="password-new"
            />
            <Text style={styles.hint}>At least 8 characters.</Text>
          </View>

          <TouchableOpacity
            style={[styles.submit, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={BRAND.authActionText} /> : <Text style={styles.submitText}>Create Account</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    inner: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
    title: { fontSize: 22, fontWeight: "700", color: theme.text, textAlign: "center" },
    subtitle: { fontSize: 13, color: BRAND.authMuted, marginBottom: 8, textAlign: "center" },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: BRAND.authMuted },
    input: {
      backgroundColor: BRAND.authInputBg,
      borderWidth: 1,
      borderColor: BRAND.authInputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    hint: { fontSize: 11, color: BRAND.authMuted },
    submit: {
      backgroundColor: BRAND.authAction,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: BRAND.authActionText, fontSize: 15, fontWeight: "600" },
  });
}
