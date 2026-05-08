import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Calendar, Clock, ArrowLeftRight, User } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useAuthStore } from "@/lib/authStore";
import { useOrgStore } from "@/lib/orgStore";
import { OrgTabHeader } from "@/components/OrgTabHeader";

export default function TabLayout() {
  const theme = useAppTheme();
  const { session } = useAuthStore();
  const { fetchOrgInfo } = useOrgStore();
  const employeeName = (session?.user?.user_metadata?.full_name as string | undefined) ?? "Profile";

  useEffect(() => {
    if (session) fetchOrgInfo();
  }, [session]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: ({ options }) => <OrgTabHeader title={options.title ?? ""} />,
        tabBarStyle: {
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
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: "Availability",
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="time-off"
        options={{
          title: "Time Off",
          tabBarIcon: ({ color, size }) => <ArrowLeftRight size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: employeeName,
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
