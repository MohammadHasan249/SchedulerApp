import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Calendar,
  Clock,
  ArrowLeftRight,
  User,
  LayoutDashboard,
  Timer,
  Users,
} from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useOrgStore } from "@/lib/orgStore";
import { OrgTabHeader } from "@/components/OrgTabHeader";
import { useIsAdmin } from "@/lib/useRole";
import { useKioskStore } from "@/lib/kioskStore";

export default function TabLayout() {
  const theme = useAppTheme();
  const { session, employeeName } = useAuthStore();
  const { fetchOrgInfo } = useOrgStore();
  const isAdmin = useIsAdmin();
  const { isLocked, hydrate: hydrateKiosk } = useKioskStore();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      fetchOrgInfo();
      hydrateKiosk();
    }
  }, [session]);

  // If the device relaunched while in kiosk mode, force it back to the
  // clock-in screen instead of whatever tab the router restores.
  useEffect(() => {
    if (isLocked) router.replace("/(tabs)/clock-in");
  }, [isLocked]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: ({ options }) => <OrgTabHeader title={options.title ?? ""} />,
        tabBarStyle: isLocked
          ? { display: "none" }
          : {
              backgroundColor: theme.bg,
              borderTopColor: theme.surface,
              borderTopWidth: 1,
              paddingBottom: 4,
            },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.secondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clock-in"
        options={{
          title: "Clock In",
          // Kiosk setup is an occasional admin action, not daily nav — reach
          // it via a button on the Dashboard instead of a permanent tab.
          href: null,
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Timer size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: "Availability",
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: "Employees",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: employeeName ?? "Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
