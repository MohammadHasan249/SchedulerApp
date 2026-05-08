import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";

export default function AdminLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        contentStyle: { backgroundColor: theme.bg },
      }}
    />
  );
}
