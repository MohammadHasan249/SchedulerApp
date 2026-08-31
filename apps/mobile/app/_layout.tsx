import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useThemeStore } from "@/lib/themeStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { getOrganizationTheme } from "@/lib/api";
import { consumeFreshInstall } from "@/lib/clearStaleKeychain";
import { BRANCH_SLUG_KEY, LOCKED_KEY } from "@/lib/kioskStore";
import * as SecureStore from "expo-secure-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { session, setSession, setEmployeeName } = useAuthStore();
  const { setTheme } = useThemeStore();
  const router = useRouter();
  const segments = useSegments();
  const isMountedRef = useRef(false);

  useEffect(() => {
    consumeFreshInstall().then((isFresh) => {
      if (!isFresh) return;
      Promise.resolve(SecureStore.deleteItemAsync(BRANCH_SLUG_KEY)).catch(() => {});
      Promise.resolve(SecureStore.deleteItemAsync(LOCKED_KEY)).catch(() => {});
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Clear per-user caches on sign-out so a different account
      // doesn't inherit the previous user's name/employee record.
      if (!session) {
        setEmployeeName(null);
        useMyEmployeeStore.getState().reset();
      }
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
