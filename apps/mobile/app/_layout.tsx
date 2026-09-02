import "@/polyfills";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Sentry from "@sentry/react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { useThemeStore } from "@/lib/themeStore";
import { useMyEmployeeStore } from "@/lib/myEmployeeStore";
import { getOrganizationTheme, getOrganizationInfo } from "@/lib/api";
import { consumeFreshInstall } from "@/lib/clearStaleKeychain";
import { BRANCH_SLUG_KEY, LOCKED_KEY } from "@/lib/kioskStore";
import { BRAND, isWrongBrandOrg } from "@/lib/brand";
import * as SecureStore from "expo-secure-store";

// Same Sentry project as the web app, tagged by platform below, so every
// client reports into one place.
Sentry.init({
  dsn: "https://f672a1513a6ab7a7536c21ccb7df6eef@o4512012425035776.ingest.us.sentry.io/4512012428378112",
  tracesSampleRate: 1,
  enableAutoSessionTracking: true,
  // Don't spam Sentry with local dev crashes from a machine that isn't
  // actually a user's device.
  enabled: !__DEV__,
});
Sentry.setTag("platform", "mobile");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default Sentry.wrap(RootLayout);

function RootLayout() {
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
      if (!session) {
        setSession(null);
        return;
      }
      // The persisted session on disk has its `user` stripped (Keychain
      // 2KB limit — see ExpoSecureStoreAdapter in supabase.ts), so refresh
      // immediately to get a full session with `user` populated, rather
      // than waiting for the SDK's near-expiry auto-refresh.
      supabase.auth.refreshSession().then(({ data }) => {
        setSession(data.session ?? session);
      });
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

  // Auth/backend are shared across brand variants (Workplix, Seau de Crabe),
  // so a valid session from one brand's org still passes Supabase auth in
  // the other brand's app build. Reject it here rather than letting an
  // employee end up signed into the wrong org's app.
  useEffect(() => {
    if (!session) return;
    getOrganizationInfo()
      .then((info) => {
        if (isWrongBrandOrg(info.slug)) {
          Alert.alert(
            "Wrong app",
            `This account's organization isn't available in the ${BRAND.displayName} app.`
          );
          supabase.auth.signOut();
        }
      })
      .catch(() => {});
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
