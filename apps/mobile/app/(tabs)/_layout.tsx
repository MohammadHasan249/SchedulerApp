import { Tabs } from "expo-router";
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
  const { isLocked, loadBranchSlug } = useKioskStore();

  useEffect(() => {
    if (session) {
      fetchOrgInfo();
      loadBranchSlug();
    }
  }, [session]);

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
          href: isAdmin ? undefined : null,
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
          href: isAdmin ? null : undefined,
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
