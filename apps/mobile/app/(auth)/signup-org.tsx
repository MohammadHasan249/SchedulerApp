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
import { useState, useEffect } from "react";
import { useRouter, Stack } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";
import { BRAND } from "@/lib/brand";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SignupOrgScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-derive slug from org name unless the user has edited it.
  useEffect(() => {
    if (!slugTouched) setOrgSlug(slugify(orgName));
  }, [orgName, slugTouched]);

  async function handleSubmit() {
    if (orgName.trim().length < 2) {
      Alert.alert("Error", "Organization name must be at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9-]{2,}$/.test(orgSlug)) {
      Alert.alert("Error", "Slug must be lowercase letters, numbers, hyphens; ≥ 2 chars.");
      return;
    }
    if (fullName.trim().length < 1) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }
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
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/org`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, orgSlug, fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error?.fieldErrors?.orgSlug?.[0] ??
          (typeof data.error === "string" ? data.error : "Something went wrong");
        Alert.alert("Signup failed", msg);
        return;
      }
      Alert.alert(
        "Check your email",
        "Your organization was created. Confirm your email, then sign in to continue.",
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
      <Stack.Screen options={{ title: "Create Organization" }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: BRAND.authBackground }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create Organization</Text>
          <Text style={styles.subtitle}>You will be the admin for this organization.</Text>

          <Field label="Organization name">
            <TextInput
              style={styles.input}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Acme Inc"
              placeholderTextColor={theme.inactive}
              autoCapitalize="words"
            />
          </Field>

          <Field label="URL slug" hint="Used for kiosk URLs. Letters, numbers, hyphens only.">
            <TextInput
              style={styles.input}
              value={orgSlug}
              onChangeText={(v) => {
                setSlugTouched(true);
                setOrgSlug(slugify(v));
              }}
              placeholder="acme-inc"
              placeholderTextColor={theme.inactive}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Your full name">
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Jane Smith"
              placeholderTextColor={theme.inactive}
              autoCapitalize="words"
            />
          </Field>

          <Field label="Email">
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.inactive}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
          </Field>

          <Field label="Password" hint="At least 8 characters.">
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.inactive}
              secureTextEntry
              autoComplete="password-new"
            />
          </Field>

          <TouchableOpacity
            style={[styles.submit, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Organization</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    inner: { flexGrow: 1, padding: 20, paddingTop: 80, gap: 14 },
    title: { fontSize: 22, fontWeight: "700", color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginBottom: 24 },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: "600", color: theme.muted },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    hint: { fontSize: 11, color: theme.muted },
    submit: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
}
