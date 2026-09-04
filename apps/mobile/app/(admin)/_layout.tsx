import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useEffect } from "react";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useIsAdmin } from "@/lib/useRole";

export default function AdminLayout() {
  const theme = useAppTheme();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { session } = useAuthStore();

  // Every screen in this group (settings-*, reports, employees/[id], ...) is
  // admin/manager-only, but nothing here was actually enforcing that — no
  // in-app link reaches these for an employee, but a direct deep link (e.g.
  // `seaudecrabe://settings-branches`) mounted them anyway: full UI rendered
  // and stayed interactive, only the underlying API calls 403'd. Gate the
  // whole group here once, the same belt-and-suspenders way clock-in.tsx
  // guards itself — a `useEffect` redirect (for the normal case) plus a hard
  // render gate below (because a `router.replace` fired from `useEffect` on a
  // screen that's the very first thing mounted, e.g. a cold deep-link launch,
  // can be silently swallowed before the navigator has settled). Returning
  // null here unmounts the whole nested Stack, so no child screen under this
  // group ever mounts for a non-admin, regardless of which one was targeted.
  // Guarded on `session` too — on sign-out, `isAdmin` also flips to false
  // (role defaults to "employee" with no session), and firing this redirect
  // at the same time as the root layout's own session->login one races it,
  // which can log a "REPLACE ... not handled" warning as the tab navigator
  // is torn down and rebuilt for the new auth state.
  useEffect(() => {
    if (session && !isAdmin) router.replace("/(tabs)/schedule");
  }, [session, isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        contentStyle: { backgroundColor: theme.bg },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
            <ChevronLeft size={24} color={theme.primary} />
          </TouchableOpacity>
        ),
      }}
    />
  );
}
