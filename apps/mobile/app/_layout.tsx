import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useThemeStore } from "@/lib/themeStore";
import { getOrganizationTheme } from "@/lib/api";

export default function RootLayout() {
  const { session, setSession } = useAuthStore();
  const { setTheme } = useThemeStore();
  const router = useRouter();
  const segments = useSegments();
  const isMountedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    getOrganizationTheme().then(setTheme).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      const role = session.user?.app_metadata?.role;
      const isAdmin = role === "org_admin" || role === "branch_manager";
      router.replace(isAdmin ? "/(tabs)/dashboard" : "/(tabs)/schedule");
    }
  }, [session, segments]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
